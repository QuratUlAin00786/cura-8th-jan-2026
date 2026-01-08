import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Resolver, SubmitHandler, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Plus, Edit, Trash2, UserPlus, Shield, Stethoscope, Users, Calendar, User, TestTube, Lock, BookOpen, X, Check, LayoutGrid, LayoutList, Eye, EyeOff, ChevronsUpDown } from "lucide-react";
import { Link, useLocation } from "wouter";
import { toast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Header } from "@/components/layout/header";
import { getActiveSubdomain } from "@/lib/subdomain-utils";
import { isDoctorLike } from "@/lib/role-utils";
import { useAuth } from "@/hooks/use-auth";

// Comprehensive country codes with ISO codes for flag API
const COUNTRY_CODES = [
  { code: "+93", name: "Afghanistan", iso: "af" },
  { code: "+355", name: "Albania", iso: "al" },
  { code: "+213", name: "Algeria", iso: "dz" },
  { code: "+376", name: "Andorra", iso: "ad" },
  { code: "+244", name: "Angola", iso: "ao" },
  { code: "+54", name: "Argentina", iso: "ar" },
  { code: "+374", name: "Armenia", iso: "am" },
  { code: "+61", name: "Australia", iso: "au" },
  { code: "+43", name: "Austria", iso: "at" },
  { code: "+994", name: "Azerbaijan", iso: "az" },
  { code: "+1-242", name: "Bahamas", iso: "bs" },
  { code: "+973", name: "Bahrain", iso: "bh" },
  { code: "+880", name: "Bangladesh", iso: "bd" },
  { code: "+1-246", name: "Barbados", iso: "bb" },
  { code: "+375", name: "Belarus", iso: "by" },
  { code: "+32", name: "Belgium", iso: "be" },
  { code: "+501", name: "Belize", iso: "bz" },
  { code: "+229", name: "Benin", iso: "bj" },
  { code: "+975", name: "Bhutan", iso: "bt" },
  { code: "+591", name: "Bolivia", iso: "bo" },
  { code: "+387", name: "Bosnia and Herzegovina", iso: "ba" },
  { code: "+267", name: "Botswana", iso: "bw" },
  { code: "+55", name: "Brazil", iso: "br" },
  { code: "+673", name: "Brunei", iso: "bn" },
  { code: "+359", name: "Bulgaria", iso: "bg" },
  { code: "+226", name: "Burkina Faso", iso: "bf" },
  { code: "+257", name: "Burundi", iso: "bi" },
  { code: "+855", name: "Cambodia", iso: "kh" },
  { code: "+237", name: "Cameroon", iso: "cm" },
  { code: "+1", name: "Canada", iso: "ca" },
  { code: "+238", name: "Cape Verde", iso: "cv" },
  { code: "+236", name: "Central African Republic", iso: "cf" },
  { code: "+235", name: "Chad", iso: "td" },
  { code: "+56", name: "Chile", iso: "cl" },
  { code: "+86", name: "China", iso: "cn" },
  { code: "+57", name: "Colombia", iso: "co" },
  { code: "+269", name: "Comoros", iso: "km" },
  { code: "+242", name: "Congo (Brazzaville)", iso: "cg" },
  { code: "+243", name: "Congo (Kinshasa)", iso: "cd" },
  { code: "+506", name: "Costa Rica", iso: "cr" },
  { code: "+385", name: "Croatia", iso: "hr" },
  { code: "+53", name: "Cuba", iso: "cu" },
  { code: "+357", name: "Cyprus", iso: "cy" },
  { code: "+420", name: "Czech Republic", iso: "cz" },
  { code: "+45", name: "Denmark", iso: "dk" },
  { code: "+253", name: "Djibouti", iso: "dj" },
  { code: "+1-767", name: "Dominica", iso: "dm" },
  { code: "+1-809", name: "Dominican Republic", iso: "do" },
  { code: "+670", name: "East Timor", iso: "tl" },
  { code: "+593", name: "Ecuador", iso: "ec" },
  { code: "+20", name: "Egypt", iso: "eg" },
  { code: "+503", name: "El Salvador", iso: "sv" },
  { code: "+240", name: "Equatorial Guinea", iso: "gq" },
  { code: "+291", name: "Eritrea", iso: "er" },
  { code: "+372", name: "Estonia", iso: "ee" },
  { code: "+268", name: "Eswatini", iso: "sz" },
  { code: "+251", name: "Ethiopia", iso: "et" },
  { code: "+679", name: "Fiji", iso: "fj" },
  { code: "+358", name: "Finland", iso: "fi" },
  { code: "+33", name: "France", iso: "fr" },
  { code: "+241", name: "Gabon", iso: "ga" },
  { code: "+220", name: "Gambia", iso: "gm" },
  { code: "+995", name: "Georgia", iso: "ge" },
  { code: "+49", name: "Germany", iso: "de" },
  { code: "+233", name: "Ghana", iso: "gh" },
  { code: "+30", name: "Greece", iso: "gr" },
  { code: "+1-473", name: "Grenada", iso: "gd" },
  { code: "+502", name: "Guatemala", iso: "gt" },
  { code: "+224", name: "Guinea", iso: "gn" },
  { code: "+245", name: "Guinea-Bissau", iso: "gw" },
  { code: "+592", name: "Guyana", iso: "gy" },
  { code: "+509", name: "Haiti", iso: "ht" },
  { code: "+504", name: "Honduras", iso: "hn" },
  { code: "+36", name: "Hungary", iso: "hu" },
  { code: "+354", name: "Iceland", iso: "is" },
  { code: "+91", name: "India", iso: "in" },
  { code: "+62", name: "Indonesia", iso: "id" },
  { code: "+98", name: "Iran", iso: "ir" },
  { code: "+964", name: "Iraq", iso: "iq" },
  { code: "+353", name: "Ireland", iso: "ie" },
  { code: "+972", name: "Israel", iso: "il" },
  { code: "+39", name: "Italy", iso: "it" },
  { code: "+225", name: "Ivory Coast", iso: "ci" },
  { code: "+1-876", name: "Jamaica", iso: "jm" },
  { code: "+81", name: "Japan", iso: "jp" },
  { code: "+962", name: "Jordan", iso: "jo" },
  { code: "+7", name: "Kazakhstan", iso: "kz" },
  { code: "+254", name: "Kenya", iso: "ke" },
  { code: "+686", name: "Kiribati", iso: "ki" },
  { code: "+850", name: "Korea, North", iso: "kp" },
  { code: "+82", name: "Korea, South", iso: "kr" },
  { code: "+965", name: "Kuwait", iso: "kw" },
  { code: "+996", name: "Kyrgyzstan", iso: "kg" },
  { code: "+856", name: "Laos", iso: "la" },
  { code: "+371", name: "Latvia", iso: "lv" },
  { code: "+961", name: "Lebanon", iso: "lb" },
  { code: "+266", name: "Lesotho", iso: "ls" },
  { code: "+231", name: "Liberia", iso: "lr" },
  { code: "+218", name: "Libya", iso: "ly" },
  { code: "+423", name: "Liechtenstein", iso: "li" },
  { code: "+370", name: "Lithuania", iso: "lt" },
  { code: "+352", name: "Luxembourg", iso: "lu" },
  { code: "+261", name: "Madagascar", iso: "mg" },
  { code: "+265", name: "Malawi", iso: "mw" },
  { code: "+60", name: "Malaysia", iso: "my" },
  { code: "+960", name: "Maldives", iso: "mv" },
  { code: "+223", name: "Mali", iso: "ml" },
  { code: "+356", name: "Malta", iso: "mt" },
  { code: "+692", name: "Marshall Islands", iso: "mh" },
  { code: "+222", name: "Mauritania", iso: "mr" },
  { code: "+230", name: "Mauritius", iso: "mu" },
  { code: "+52", name: "Mexico", iso: "mx" },
  { code: "+691", name: "Micronesia", iso: "fm" },
  { code: "+373", name: "Moldova", iso: "md" },
  { code: "+377", name: "Monaco", iso: "mc" },
  { code: "+976", name: "Mongolia", iso: "mn" },
  { code: "+382", name: "Montenegro", iso: "me" },
  { code: "+212", name: "Morocco", iso: "ma" },
  { code: "+258", name: "Mozambique", iso: "mz" },
  { code: "+95", name: "Myanmar", iso: "mm" },
  { code: "+264", name: "Namibia", iso: "na" },
  { code: "+674", name: "Nauru", iso: "nr" },
  { code: "+977", name: "Nepal", iso: "np" },
  { code: "+31", name: "Netherlands", iso: "nl" },
  { code: "+64", name: "New Zealand", iso: "nz" },
  { code: "+505", name: "Nicaragua", iso: "ni" },
  { code: "+227", name: "Niger", iso: "ne" },
  { code: "+234", name: "Nigeria", iso: "ng" },
  { code: "+389", name: "North Macedonia", iso: "mk" },
  { code: "+47", name: "Norway", iso: "no" },
  { code: "+968", name: "Oman", iso: "om" },
  { code: "+92", name: "Pakistan", iso: "pk" },
  { code: "+680", name: "Palau", iso: "pw" },
  { code: "+507", name: "Panama", iso: "pa" },
  { code: "+675", name: "Papua New Guinea", iso: "pg" },
  { code: "+595", name: "Paraguay", iso: "py" },
  { code: "+51", name: "Peru", iso: "pe" },
  { code: "+63", name: "Philippines", iso: "ph" },
  { code: "+48", name: "Poland", iso: "pl" },
  { code: "+351", name: "Portugal", iso: "pt" },
  { code: "+974", name: "Qatar", iso: "qa" },
  { code: "+40", name: "Romania", iso: "ro" },
  { code: "+7", name: "Russia", iso: "ru" },
  { code: "+250", name: "Rwanda", iso: "rw" },
  { code: "+1-869", name: "Saint Kitts and Nevis", iso: "kn" },
  { code: "+1-758", name: "Saint Lucia", iso: "lc" },
  { code: "+1-784", name: "Saint Vincent & Grenadines", iso: "vc" },
  { code: "+685", name: "Samoa", iso: "ws" },
  { code: "+378", name: "San Marino", iso: "sm" },
  { code: "+239", name: "Sao Tome and Principe", iso: "st" },
  { code: "+966", name: "Saudi Arabia", iso: "sa" },
  { code: "+221", name: "Senegal", iso: "sn" },
  { code: "+381", name: "Serbia", iso: "rs" },
  { code: "+248", name: "Seychelles", iso: "sc" },
  { code: "+232", name: "Sierra Leone", iso: "sl" },
  { code: "+65", name: "Singapore", iso: "sg" },
  { code: "+421", name: "Slovakia", iso: "sk" },
  { code: "+386", name: "Slovenia", iso: "si" },
  { code: "+677", name: "Solomon Islands", iso: "sb" },
  { code: "+252", name: "Somalia", iso: "so" },
  { code: "+27", name: "South Africa", iso: "za" },
  { code: "+211", name: "South Sudan", iso: "ss" },
  { code: "+34", name: "Spain", iso: "es" },
  { code: "+94", name: "Sri Lanka", iso: "lk" },
  { code: "+249", name: "Sudan", iso: "sd" },
  { code: "+597", name: "Suriname", iso: "sr" },
  { code: "+46", name: "Sweden", iso: "se" },
  { code: "+41", name: "Switzerland", iso: "ch" },
  { code: "+963", name: "Syria", iso: "sy" },
  { code: "+886", name: "Taiwan", iso: "tw" },
  { code: "+992", name: "Tajikistan", iso: "tj" },
  { code: "+255", name: "Tanzania", iso: "tz" },
  { code: "+66", name: "Thailand", iso: "th" },
  { code: "+228", name: "Togo", iso: "tg" },
  { code: "+676", name: "Tonga", iso: "to" },
  { code: "+1-868", name: "Trinidad and Tobago", iso: "tt" },
  { code: "+216", name: "Tunisia", iso: "tn" },
  { code: "+90", name: "Turkey", iso: "tr" },
  { code: "+993", name: "Turkmenistan", iso: "tm" },
  { code: "+688", name: "Tuvalu", iso: "tv" },
  { code: "+256", name: "Uganda", iso: "ug" },
  { code: "+380", name: "Ukraine", iso: "ua" },
  { code: "+971", name: "United Arab Emirates", iso: "ae" },
  { code: "+44", name: "United Kingdom", iso: "gb" },
  { code: "+1", name: "United States", iso: "us" },
  { code: "+598", name: "Uruguay", iso: "uy" },
  { code: "+998", name: "Uzbekistan", iso: "uz" },
  { code: "+678", name: "Vanuatu", iso: "vu" },
  { code: "+379", name: "Vatican City", iso: "va" },
  { code: "+58", name: "Venezuela", iso: "ve" },
  { code: "+84", name: "Vietnam", iso: "vn" },
  { code: "+967", name: "Yemen", iso: "ye" },
  { code: "+260", name: "Zambia", iso: "zm" },
  { code: "+263", name: "Zimbabwe", iso: "zw" }
] as const;

// Digit limits for each country code (excluding country code itself)
const COUNTRY_DIGIT_LIMITS: Record<string, number> = {
  "+1": 10, "+44": 10, "+32": 9, "+971": 9, "+966": 9, "+93": 9, "+355": 9,
  "+213": 9, "+376": 9, "+244": 9, "+54": 10, "+374": 8, "+61": 9, "+43": 10,
  "+994": 9, "+1-242": 10, "+973": 8, "+880": 10, "+1-246": 10, "+375": 9,
  "+501": 7, "+229": 8, "+975": 8, "+591": 8, "+387": 8, "+267": 8, "+55": 11,
  "+673": 7, "+359": 9, "+226": 8, "+257": 8, "+855": 9, "+237": 9, "+238": 7,
  "+236": 8, "+235": 8, "+56": 9, "+86": 11, "+57": 10, "+269": 7, "+242": 9,
  "+243": 9, "+506": 8, "+385": 9, "+53": 8, "+357": 8, "+420": 9, "+45": 8,
  "+253": 8, "+1-767": 10, "+1-809": 10, "+670": 8, "+593": 9, "+20": 10,
  "+503": 8, "+240": 9, "+291": 7, "+372": 8, "+268": 8, "+251": 9, "+679": 7,
  "+358": 10, "+33": 9, "+241": 8, "+220": 7, "+995": 9, "+49": 11, "+233": 9,
  "+30": 10, "+1-473": 10, "+502": 8, "+224": 9, "+245": 9, "+592": 7, "+509": 8,
  "+504": 8, "+36": 9, "+354": 7, "+91": 10, "+62": 11, "+98": 10, "+964": 10,
  "+353": 9, "+972": 9, "+39": 10, "+225": 10, "+1-876": 10, "+81": 10, "+962": 9,
  "+7": 10, "+254": 10, "+686": 8, "+850": 10, "+82": 10, "+965": 8, "+996": 9,
  "+856": 10, "+371": 8, "+961": 8, "+266": 8, "+231": 9, "+218": 10, "+423": 7,
  "+370": 8, "+352": 9, "+261": 9, "+265": 9, "+60": 10, "+960": 7, "+223": 8,
  "+356": 8, "+692": 7, "+222": 8, "+230": 8, "+52": 10, "+691": 7, "+373": 8,
  "+377": 8, "+976": 8, "+382": 8, "+212": 9, "+258": 9, "+95": 9, "+264": 9,
  "+674": 7, "+977": 10, "+31": 9, "+64": 9, "+505": 8, "+227": 8, "+234": 10,
  "+389": 8, "+47": 8, "+968": 8, "+92": 10, "+680": 7, "+507": 8, "+675": 8,
  "+595": 9, "+51": 9, "+63": 10, "+48": 9, "+351": 9, "+974": 8, "+40": 10,
  "+250": 9, "+1-869": 10, "+1-758": 10, "+1-784": 10, "+685": 7, "+378": 10,
  "+239": 7, "+221": 9, "+381": 9, "+248": 7, "+232": 8, "+65": 8, "+421": 9,
  "+386": 8, "+677": 7, "+252": 9, "+27": 9, "+211": 9, "+34": 9, "+94": 9,
  "+249": 9, "+597": 7, "+46": 10, "+41": 9, "+963": 9, "+886": 9, "+992": 9,
  "+255": 9, "+66": 9, "+228": 8, "+676": 7, "+1-868": 10, "+216": 8, "+90": 10,
  "+993": 8, "+688": 6, "+256": 9, "+380": 9, "+598": 8, "+998": 9, "+678": 7,
  "+379": 10, "+58": 10, "+84": 10, "+967": 9, "+260": 9, "+263": 9
};

// Plan types for patient insurance
const PLAN_TYPES = [
  { value: "Individual Plan", description: "Covers a single person — the most basic private insurance plan." },
  { value: "Couple Plan", description: "Covers two adults (usually partners or spouses) under one policy." },
  { value: "Family Plan", description: "Covers two adults and their children. Offers better value for multiple family members." },
  { value: "Company / Corporate Plan", description: "Provided by an employer as part of employee benefits. Often includes extended or premium coverage." },
  { value: "Self-Employed Plan", description: "Tailored for freelancers or business owners who don't have employer coverage." },
  { value: "Comprehensive Plan", description: "Offers full private medical coverage, including inpatient, outpatient, diagnostic tests, specialist visits, and sometimes dental/optical." },
  { value: "Treatment-Only Plan", description: "Covers inpatient and day-patient treatments only — cheaper than full plans." },
  { value: "Inpatient-Only Plan", description: "Covers hospital stays and surgeries, but not outpatient appointments." },
  { value: "Outpatient-Only Plan", description: "Covers diagnostics, consultations, and follow-ups, but not inpatient care." },
  { value: "Cash Plan", description: "Pays a fixed cash amount for treatments like dental, optical, physiotherapy, or GP visits — good for small, routine expenses." },
  { value: "Dental Plan", description: "Covers private dental care (check-ups, fillings, orthodontics, etc.)." },
  { value: "Travel Health Plan", description: "Covers medical emergencies abroad — often used for frequent travelers or expats." },
  { value: "Other", description: "Other" }
];

// Medical Departments for the editable dropdown
const DEPARTMENTS = [
  "General Medicine",
  "Family Medicine",
  "Emergency Medicine / ER",
  "Geriatrics",
  "General Surgery",
  "Cardiothoracic Surgery",
  "Neurosurgery",
  "Orthopedic Surgery",
  "Plastic & Reconstructive Surgery",
  "Pediatric Surgery",
  "Urology",
  "Cardiology (Heart diseases, hypertension, arrhythmia)",
  "Cardiothoracic Surgery (Heart surgery)",
  "Interventional Cardiology (Stents, angioplasty)",
  "Cardiac Rehabilitation",
  "Neurology (Brain, spinal cord, nerves)",
  "Psychiatry & Mental Health",
  "Neurorehabilitation",
  "Pediatrics (General child health)",
  "Neonatology (Newborns)",
  "Pediatric Cardiology",
  "Obstetrics (Pregnancy & childbirth)",
  "Gynecology (Female reproductive health)",
  "Infertility & IVF",
  "Maternal-Fetal Medicine",
  "Pulmonology (Lungs & breathing)",
  "Thoracic Surgery",
  "Sleep Medicine",
  "Gastroenterology (Digestive system)",
  "Hepatology (Liver & pancreas)",
  "Endoscopy / GI Surgery",
  "Nephrology (Kidneys)",
  "Dialysis",
  "Orthopedic Surgery (Bones & joints)",
  "Physiotherapy / Rehabilitation",
  "Sports Medicine",
  "Ear, Nose, Throat (ENT)",
  "Audiology / Hearing clinic",
  "Maxillofacial Surgery",
  "Eye Clinic / Vision Care",
  "Retina / Cornea / Glaucoma",
  "Pediatric Ophthalmology",
  "Medical Oncology (Chemotherapy)",
  "Surgical Oncology",
  "Radiation Oncology",
  "Hematology-Oncology",
  "Radiology / X-ray / CT / MRI / Ultrasound",
  "Nuclear Medicine",
  "Pathology / Lab Medicine",
  "Genetic Testing",
  "Dermatology",
  "Cosmetology / Aesthetic Medicine",
  "Venereology (STDs)",
  "Dentistry / Orthodontics",
  "Oral & Maxillofacial Surgery",
  "Prosthodontics",
  "ICU (Intensive Care Unit)",
  "CCU (Coronary Care Unit)",
  "Trauma / Accident & Emergency",
  "Anesthesiology",
  "Pain Management",
  "Rheumatology",
  "Endocrinology (Diabetes, Thyroid)",
  "Immunology & Allergy",
  "Transplant Services (Liver, Kidney, Heart)",
  "Palliative Care / Hospice",
  "Occupational Medicine"
];

const passwordRequirementRules = [
  {
    test: (value: string) => value.length >= 8,
    message: "Password must be at least 8 characters long",
  },
  {
    test: (value: string) => /[A-Z]/.test(value),
    message: "Password must include at least one uppercase letter",
  },
  {
    test: (value: string) => /[a-z]/.test(value),
    message: "Password must include at least one lowercase letter",
  },
  {
    test: (value: string) => /[0-9]/.test(value),
    message: "Password must include at least one number",
  },
  {
    test: (value: string) => /[!@#$%^&*()_\-+={}[\]|\\:;"'<>,.?/~`]/.test(value),
    message: "Password must include at least one special character",
  },
];

const validatePasswordValue = (value: string, ctx: z.RefinementCtx) => {
  passwordRequirementRules.forEach((rule) => {
    if (!rule.test(value)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: rule.message,
      });
    }
  });
};

const userSchema = z.object({
  email: z.string().min(1, "Email address is required").email("Please enter a valid email address"),
  firstName: z.string().min(2, "First name must be at least 2 characters").max(30, "First name must not exceed 30 characters"),
  lastName: z.string().min(2, "Last name must be at least 2 characters").max(30, "Last name must not exceed 30 characters"),
  role: z.string().min(1, "Role is required"),
  department: z.string().optional(),
  medicalSpecialtyCategory: z.string().optional(),
  subSpecialty: z.string().optional(),
  workingDays: z.array(z.string()).optional(),
  workingHours: z.object({
    start: z.string().optional(),
    end: z.string().optional(),
  }).optional(),
  password: z.string().optional().superRefine((value, ctx) => {
    if (!value) return;
    validatePasswordValue(value, ctx);
  }),
  // Patient-specific fields
  dateOfBirth: z.string().optional(),
  dobDay: z.string().optional(),
  dobMonth: z.string().optional(),
  dobYear: z.string().optional(),
  phone: z.string().optional(),
  nhsNumber: z.string()
    .optional()
    .refine(
      (val) => !val || /^\d{0,10}$/.test(val.replace(/\s/g, '')),
      "NHS Number must be exactly 10 digits"
    ),
  genderAtBirth: z.string().optional(),
  address: z.object({
    street: z.string().optional(),
    city: z.string().optional(),
    state: z.string().optional(),
    postcode: z.string().optional(),
    country: z.string().optional(),
    building: z.string().optional(),
  }).optional(),
  emergencyContact: z.object({
    name: z.string().optional(),
    relationship: z.string().optional(),
    phone: z.string().optional(),
    email: z.string().optional(),
  }).optional(),
  insuranceInfo: z.object({
    provider: z.string().optional(),
    policyNumber: z.string().optional(),
    memberNumber: z.string().optional(),
    planType: z.string().optional(),
    effectiveDate: z.string().optional(),
  }).optional(),
});

const roleSchema = z.object({
  name: z.string()
    .min(1, "Role name is required")
    .regex(/^[a-z_]+$/, "Role name must contain only lowercase letters and underscores"),
  displayName: z.string().min(1, "Display name is required"),
  description: z.string().min(1, "Description is required"),
  permissions: z.object({
    modules: z.record(z.string(), z.object({
      view: z.boolean(),
      create: z.boolean(),
      edit: z.boolean(),
      delete: z.boolean(),
    })).optional().default({}),
    fields: z.record(z.string(), z.object({
      view: z.boolean(),
      edit: z.boolean(),
    })).optional().default({}),
  }),
});

type UserFormData = z.infer<typeof userSchema>;
type RoleFormData = z.infer<typeof roleSchema>;

// Permission templates for complete module and field initialization
type ModulePermission = {
  view: boolean;
  create: boolean;
  edit: boolean;
  delete: boolean;
};

type FieldPermission = {
  view: boolean;
  edit: boolean;
};

const MODULE_KEYS = [
  'dashboard', 'patients', 'appointments', 'medicalRecords', 'prescriptions', 'billing', 
  'analytics', 'userManagement', 'shiftManagement', 'settings', 'aiInsights', 'messaging', 
  'telemedicine', 'labResults', 'medicalImaging', 'forms', 'integrations',
  'automation', 'patientPortal', 'populationHealth', 'voiceDocumentation',
  'inventory', 'gdprCompliance', 'subscription'
] as const;

const FIELD_KEYS = [
  'patientSensitiveInfo', 'financialData', 'medicalHistory', 'prescriptionDetails',
  'labResults', 'imagingResults', 'billingInformation', 'insuranceDetails'
] as const;

const createEmptyModulePermission = (): ModulePermission => ({
  view: false,
  create: false,
  edit: false,
  delete: false,
});

const createEmptyFieldPermission = (): FieldPermission => ({
  view: false,
  edit: false,
});

const MODULE_PERMISSIONS_LIST = [
  { key: 'dashboard', name: 'Dashboard', description: 'Access main dashboard' },
  { key: 'patients', name: 'Patients', description: 'Manage patient records and information' },
  { key: 'appointments', name: 'Appointments', description: 'Schedule and manage appointments' },
  { key: 'prescriptions', name: 'Prescriptions', description: 'Prescribe and manage medications' },
  { key: 'labResults', name: 'Lab Results', description: 'Manage laboratory results' },
  { key: 'medicalImaging', name: 'Imaging', description: 'View and manage medical images' },
  { key: 'forms', name: 'Forms', description: 'Create and manage forms' },
  { key: 'messaging', name: 'Messaging', description: 'Send messages and notifications' },
  { key: 'analytics', name: 'Analytics', description: 'View reports and analytics' },
  { key: 'clinicalDecision', name: 'Clinical Decision Support', description: 'AI-powered clinical decision assistance' },
  { key: 'symptomChecker', name: 'Symptom Checker', description: 'Patient symptom assessment tool' },
  { key: 'telemedicine', name: 'Telemedicine', description: 'Video consultations' },
  { key: 'voiceDocumentation', name: 'Voice Documentation', description: 'Voice-to-text documentation' },
  { key: 'financialIntelligence', name: 'Financial Intelligence', description: 'Financial analytics and insights' },
  { key: 'billing', name: 'Billing', description: 'Process payments and invoicing' },
  { key: 'quickbooks', name: 'QuickBooks', description: 'QuickBooks accounting integration' },
  { key: 'inventory', name: 'Inventory', description: 'Manage medical inventory' },
  { key: 'medicalRecords', name: 'Medical Records', description: 'Create and view medical records' },
  { key: 'integrations', name: 'Integrations', description: 'Connect external services' },
  { key: 'gdprCompliance', name: 'GDPR Compliance', description: 'Data privacy and compliance' },
  { key: 'userManagement', name: 'User Management', description: 'Manage system users and roles' },
  { key: 'shiftManagement', name: 'Shift Management', description: 'Manage staff shifts and schedules' },
  { key: 'settings', name: 'Settings', description: 'Configure system settings' },
  { key: 'subscription', name: 'Subscription', description: 'Manage subscription and packages' }
] as const;

const MODULE_ACTIONS = ['view', 'create', 'edit', 'delete'] as const;
type ModuleAction = (typeof MODULE_ACTIONS)[number];

const isActionFullyEnabled = (modulesData: Record<string, ModulePermission>, action: ModuleAction) => {
  return MODULE_PERMISSIONS_LIST.every((module) => modulesData[module.key]?.[action]);
};

const toggleActionForAllModules = (
  roleForm: ReturnType<typeof useForm<RoleFormData>>,
  action: ModuleAction,
  enable: boolean
) => {
  MODULE_PERMISSIONS_LIST.forEach((module) => {
    const existing = roleForm.getValues(`permissions.modules.${module.key}`) || createEmptyModulePermission();
    roleForm.setValue(`permissions.modules.${module.key}`, { ...existing, [action]: enable }, {
      shouldValidate: false,
      shouldDirty: true,
    });
  });
};

const getDefaultModulePermissions = (): Record<string, ModulePermission> =>
  MODULE_KEYS.reduce<Record<string, ModulePermission>>((acc, moduleKey) => {
    acc[moduleKey] = { ...createEmptyModulePermission() };
    return acc;
  }, {});

const getDefaultFieldPermissions = (): Record<string, FieldPermission> =>
  FIELD_KEYS.reduce<Record<string, FieldPermission>>((acc, fieldKey) => {
    acc[fieldKey] = { ...createEmptyFieldPermission() };
    return acc;
  }, {});

const normalizeModulePermissions = (input?: Record<string, any>): Record<string, ModulePermission> =>
  MODULE_KEYS.reduce<Record<string, ModulePermission>>((acc, moduleKey) => {
    const value = input?.[moduleKey];
    acc[moduleKey] = {
      view: Boolean(value?.view),
      create: Boolean(value?.create),
      edit: Boolean(value?.edit),
      delete: Boolean(value?.delete),
    };
    return acc;
  }, {});

const normalizeFieldPermissions = (input?: Record<string, any>): Record<string, FieldPermission> =>
  FIELD_KEYS.reduce<Record<string, FieldPermission>>((acc, fieldKey) => {
    const value = input?.[fieldKey];
    acc[fieldKey] = {
      view: Boolean(value?.view),
      edit: Boolean(value?.edit),
    };
    return acc;
  }, {});

interface User {
  id: number;
  email: string;
  firstName: string;
  lastName: string;
  role: string;
  department?: string;
  medicalSpecialtyCategory?: string;
  subSpecialty?: string;
  workingDays?: string[];
  workingHours?: {
    start: string;
    end: string;
  };
  permissions?: {
    modules?: any;
    fields?: any;
  };
  isActive: boolean;
  lastLoginAt?: string;
  createdAt: string;
  // Patient-specific fields
  dateOfBirth?: string;
  phone?: string;
  nhsNumber?: string;
  genderAtBirth?: string;
  address?: {
    street?: string;
    city?: string;
    state?: string;
    postcode?: string;
    country?: string;
  };
  emergencyContact?: {
    name?: string;
    relationship?: string;
    phone?: string;
    email?: string;
  };
  insuranceInfo?: {
    provider?: string;
    policyNumber?: string;
    memberNumber?: string;
    planType?: string;
    effectiveDate?: string;
  };
  // Insurance verification from insurance_verifications table
  insuranceVerification?: {
    id?: number;
    provider?: string;
    policyNumber?: string;
    groupNumber?: string;
    memberNumber?: string;
    planType?: string;
    coverageType?: string;
    status?: string;
    eligibilityStatus?: string;
    effectiveDate?: string;
    expirationDate?: string;
    lastVerified?: string;
    benefits?: any;
  };
}

interface Role {
  id: number;
  name: string;
  displayName: string;
  description: string;
  permissions: {
    modules: Record<string, {
      view: boolean;
      create: boolean;
      edit: boolean;
      delete: boolean;
    }>;
    fields: Record<string, {
      view: boolean;
      edit: boolean;
    }>;
  };
  isSystem: boolean;
  createdAt: string;
  updatedAt: string;
}

// Medical Specialties Data Structure
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
    "Urological Surgeon": ["Surgical urological procedures"]
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
] as const;

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
] as const;

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
] as const;

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
] as const;

// Physiotherapist Subcategories
const physiotherapistSubcategories = [
  "Orthopedic Physiotherapist",
  "Neurological Physiotherapist",
  "Cardiopulmonary Physiotherapist",
  "Pediatric Physiotherapist",
  "Geriatric Physiotherapist",
  "Sports Physiotherapist",
  "Women's Health Physiotherapist",
  "Vestibular Physiotherapist",
  "Rehabilitation Physiotherapist",
  "ICU/Respiratory Physiotherapist",
  "Occupational Health Physiotherapist",
  "Manual Therapy Specialist",
  "Community Physiotherapist",
  "Aquatic Physiotherapist",
  "Pain Management Physiotherapist",
  "Pelvic Health Physiotherapist",
  "Amputee Physiotherapist",
  "Burn Rehabilitation Physiotherapist",
  "Spinal Physiotherapist",
  "Hand Therapist"
] as const;

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
] as const;

// Sample Taker Subcategories
const sampleTakerSubcategories = [
  "Phlebotomist",
  "Nasopharyngeal Swab Collector",
  "Urine Sample Collector",
  "Saliva Sample Collector",
  "Stool Sample Collector",
  "Sputum Sample Collector",
  "Skin/Biopsy Sample Assistant",
  "Blood Culture Specialist",
  "Pediatric Sample Taker",
  "Geriatric Sample Taker",
  "Mobile Sample Collector",
  "Prenatal Sample Collector",
  "Toxicology Sample Collector",
  "Sexual Health Sample Collector",
  "Research Sample Collector",
  "Infection Control Sample Taker"
] as const;

// Reusable SearchableSelect Component
interface SearchableSelectProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  value: string;
  onSelect: (value: string) => void;
  options: Array<{ value: string; label: string }>;
  placeholder?: string;
  searchPlaceholder?: string;
  emptyText?: string;
  testId?: string;
  disabled?: boolean;
}

function SearchableSelect({
  open,
  onOpenChange,
  value,
  onSelect,
  options,
  placeholder = "Select option...",
  searchPlaceholder = "Search...",
  emptyText = "No option found.",
  testId = "searchable-select",
  disabled = false
}: SearchableSelectProps) {
  const selectedOption = options.find(opt => opt.value === value);
  
  return (
    <Popover open={open} onOpenChange={onOpenChange}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className="w-full justify-between font-normal"
          data-testid={`${testId}-trigger`}
          disabled={disabled}
        >
          <span className={value ? "text-foreground" : "text-muted-foreground"}>
            {selectedOption?.label || placeholder}
          </span>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-full p-0" align="start">
        <Command>
          <CommandInput 
            placeholder={searchPlaceholder} 
            data-testid={`${testId}-input`}
          />
          <CommandList>
            <CommandEmpty>{emptyText}</CommandEmpty>
            <CommandGroup>
              {options.map((option, index) => (
                <CommandItem
                  key={option.value}
                  value={option.value}
                  onSelect={() => {
                    onSelect(option.value);
                    onOpenChange(false);
                  }}
                  data-testid={`${testId}-option-${index}`}
                >
                  <Check
                    className={`mr-2 h-4 w-4 ${value === option.value ? "opacity-100" : "opacity-0"}`}
                  />
                  {option.label}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

export default function UserManagement() {
  const [, setLocation] = useLocation();
  const { user } = useAuth();
  const canManageRoles = user?.role === "admin";
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [successMessage, setSuccessMessage] = useState("");
  const [successTitle, setSuccessTitle] = useState("");
  const getInitialPermissions = () => ({
    modules: getDefaultModulePermissions(),
    fields: getDefaultFieldPermissions(),
  });
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [departmentOpen, setDepartmentOpen] = useState(false);
  const [roleOpen, setRoleOpen] = useState(false);
  const [specialtyCategoryOpen, setSpecialtyCategoryOpen] = useState(false);
  const [subSpecialtyOpen, setSubSpecialtyOpen] = useState(false);
  const [specificAreaOpen, setSpecificAreaOpen] = useState(false);
  const [labTechSubcategoryOpen, setLabTechSubcategoryOpen] = useState(false);
  const [pharmacistSubcategoryOpen, setPharmacistSubcategoryOpen] = useState(false);
  const [opticianSubcategoryOpen, setOpticianSubcategoryOpen] = useState(false);
  const [paramedicSubcategoryOpen, setParamedicSubcategoryOpen] = useState(false);
  const [physiotherapistSubcategoryOpen, setPhysiotherapistSubcategoryOpen] = useState(false);
  const [aestheticianSubcategoryOpen, setAestheticianSubcategoryOpen] = useState(false);
  const [selectedRole, setSelectedRole] = useState<string>("doctor");
  const isPatientRole = selectedRole.toLowerCase() === "patient";

  // Fetch roles from the roles table filtered by organization_id
  const { data: rolesData = [] } = useQuery({
    queryKey: ["/api/roles"],
    queryFn: async () => {
      try {
        const response = await apiRequest("GET", "/api/roles");
        const data = await response.json();
        return Array.isArray(data) ? data : [];
      } catch (error) {
        console.error("Roles fetch error:", error);
        return [];
      }
    },
  });

  // Fetch subscription limits when modal is open
  const { data: subscriptionLimitData, isLoading: isLoadingSubscriptionLimit } = useQuery({
    queryKey: ["/api/users/check-subscription-limit"],
    queryFn: async () => {
      try {
        const response = await apiRequest("GET", "/api/users/check-subscription-limit");
        const data = await response.json();
        return data;
      } catch (error) {
        console.error("Subscription limit fetch error:", error);
        return null;
      }
    },
    enabled: isCreateModalOpen && !editingUser, // Only fetch when creating new user
  });
  
  // Doctor specialty states
  const [selectedSpecialtyCategory, setSelectedSpecialtyCategory] = useState<string>("");
  const [selectedSubSpecialty, setSelectedSubSpecialty] = useState<string>("");
  const [selectedSpecificArea, setSelectedSpecificArea] = useState<string>("");
  
  // Lab Technician subcategory state
  const [selectedLabTechSubcategory, setSelectedLabTechSubcategory] = useState<string>("");
  
  // Pharmacist subcategory state
  const [selectedPharmacistSubcategory, setSelectedPharmacistSubcategory] = useState<string>("");
  
  // Optician subcategory state
  const [selectedOpticianSubcategory, setSelectedOpticianSubcategory] = useState<string>("");
  
  // Paramedic subcategory state
  const [selectedParamedicSubcategory, setSelectedParamedicSubcategory] = useState<string>("");
  
  // Physiotherapist subcategory state
  const [selectedPhysiotherapistSubcategory, setSelectedPhysiotherapistSubcategory] = useState<string>("");
  
  // Aesthetician subcategory state
  const [selectedAestheticianSubcategory, setSelectedAestheticianSubcategory] = useState<string>("");
  
  // Sample Taker subcategory state
  const [selectedSampleTakerSubcategory, setSelectedSampleTakerSubcategory] = useState<string>("");
  
  // Role management states
  const [isRoleModalOpen, setIsRoleModalOpen] = useState(false);
  const [editingRole, setEditingRole] = useState<Role | null>(null);
  const [activeTab, setActiveTab] = useState<"users" | "roles">("users");
  const [roleNameError, setRoleNameError] = useState<string>("");
  const [roleDisplayNameError, setRoleDisplayNameError] = useState<string>("");
  
  // View type states
  const [userViewType, setUserViewType] = useState<"list" | "grid">("list");
  const [roleViewType, setRoleViewType] = useState<"list" | "grid">("list");
  
  // Role filter state
  const [roleFilter, setRoleFilter] = useState<string>("all");
  
  // Email validation states
  const [emailValidationStatus, setEmailValidationStatus] = useState<'idle' | 'checking' | 'available' | 'exists'>('idle');
  const [emailCheckTimeout, setEmailCheckTimeout] = useState<NodeJS.Timeout | null>(null);

  // Date of Birth states
  const [dobDay, setDobDay] = useState<string>("");
  const [dobMonth, setDobMonth] = useState<string>("");
  const [dobYear, setDobYear] = useState<string>("");
  const [dobErrors, setDobErrors] = useState<{ day?: string; month?: string; year?: string; combined?: string }>({});
  
  // Insurance Provider and NHS Number states
  const [insuranceProvider, setInsuranceProvider] = useState<string>("");
  const [nhsNumberError, setNhsNumberError] = useState<string>("");
  
  // Plan Type state (for Patient role)
  const [selectedPlanType, setSelectedPlanType] = useState<string>("");
  const [planTypeOpen, setPlanTypeOpen] = useState(false);
  
  const [postcodeLookupMessage, setPostcodeLookupMessage] = useState("");
  const [lookupAddresses, setLookupAddresses] = useState<string[]>([]);
  const [lookupLoading, setLookupLoading] = useState(false);
  const [selectedAddressDetails, setSelectedAddressDetails] = useState<{
    street: string;
    city: string;
    postcode: string;
    building: string;
    district?: string;
    county?: string;
    country?: string;
  } | null>(null);

  // Phone country code states
  const [selectedPhoneCountryCode, setSelectedPhoneCountryCode] = useState("+44");
  const [selectedEmergencyPhoneCountryCode, setSelectedEmergencyPhoneCountryCode] = useState("+44");
  const [countryCodePopoverOpen, setCountryCodePopoverOpen] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  
  // Postcode auto-detection state
  const [isDetectingCountry, setIsDetectingCountry] = useState(false);
  const [detectionTimeout, setDetectionTimeout] = useState<NodeJS.Timeout | null>(null);

  const [users, setUsers] = useState<User[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<any>(null);

  const fetchUsers = async () => {
    try {
      setIsLoading(true);
      const response = await apiRequest("GET", "/api/users");
      const userData = await response.json();
      setUsers(userData);
      setError(null);
    } catch (err) {
      setError(err);
      setUsers([]);
    } finally {
      setIsLoading(false);
    }
  };

  const refetch = fetchUsers;
  
  // Date of Birth helper functions
  const isLeapYear = (year: number) => {
    return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
  };

  const getDaysInMonth = (month: number, year: number) => {
    if (month === 2) return isLeapYear(year) ? 29 : 28;
    if ([4, 6, 9, 11].includes(month)) return 30;
    return 31;
  };

  // Generate dynamic day options based on selected month and year
  const getDayOptions = () => {
    if (!dobMonth || !dobYear) return Array.from({ length: 31 }, (_, i) => i + 1);
    const maxDays = getDaysInMonth(parseInt(dobMonth), parseInt(dobYear));
    return Array.from({ length: maxDays }, (_, i) => i + 1);
  };

  // Validate Date of Birth
  const validateDOB = (day: string, month: string, year: string) => {
    const errors: { day?: string; month?: string; year?: string; combined?: string } = {};
    
    // Check if all fields are filled
    if (!day && !month && !year) {
      return errors; // Optional field, no error if all empty
    }
    
    if (!day) errors.day = "Day is required";
    if (!month) errors.month = "Month is required";
    if (!year) errors.year = "Year is required";
    
    // If any field is missing, return early
    if (errors.day || errors.month || errors.year) {
      setDobErrors(errors);
      return errors;
    }
    
    const dayNum = parseInt(day);
    const monthNum = parseInt(month);
    const yearNum = parseInt(year);
    
    // Validate ranges
    if (dayNum < 1 || dayNum > 31) {
      errors.day = "Invalid day";
    }
    if (monthNum < 1 || monthNum > 12) {
      errors.month = "Invalid month";
    }
    if (yearNum < 1900 || yearNum > new Date().getFullYear()) {
      errors.year = "Year must be between 1900 and current year";
    }
    
    // Check if day is valid for the month
    if (!errors.day && !errors.month && !errors.year) {
      const maxDays = getDaysInMonth(monthNum, yearNum);
      if (dayNum > maxDays) {
        errors.day = `${monthNum === 2 ? (isLeapYear(yearNum) ? 'February' : 'February') : 'This month'} only has ${maxDays} days`;
      }
      
      // Check for future date
      const selectedDate = new Date(yearNum, monthNum - 1, dayNum);
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      if (selectedDate > today) {
        errors.combined = "Date of birth cannot be in the future";
      }
      
      // Age calculation removed - no age limit for patients
    }
    
    setDobErrors(errors);
    return errors;
  };

  // Handle DOB field changes
  const handleDobDayChange = (value: string) => {
    setDobDay(value);
    form.setValue("dobDay", value);
    validateDOB(value, dobMonth, dobYear);
  };

  const handleDobMonthChange = (value: string) => {
    setDobMonth(value);
    form.setValue("dobMonth", value);
    
    // Adjust day if it exceeds the new month's max days
    if (dobDay && dobYear) {
      const maxDays = getDaysInMonth(parseInt(value), parseInt(dobYear));
      if (parseInt(dobDay) > maxDays) {
        setDobDay(maxDays.toString());
        form.setValue("dobDay", maxDays.toString());
      }
    }
    
    validateDOB(dobDay, value, dobYear);
  };

  const handleDobYearChange = (value: string) => {
    setDobYear(value);
    form.setValue("dobYear", value);
    
    // Adjust day if it's February 29 and year is not a leap year
    if (dobDay && dobMonth === "2" && dobDay === "29") {
      if (!isLeapYear(parseInt(value))) {
        setDobDay("28");
        form.setValue("dobDay", "28");
      }
    }
    
    validateDOB(dobDay, dobMonth, value);
  };
  
  // Auto-lookup city and state from postcode based on selected country
  const detectCountryFromPostcode = async (postcode: string) => {
    const selectedCountry = form.watch("address.country");
    
    console.log('🌍 Auto-lookup triggered:', { postcode, selectedCountry });
    
    // Validate inputs
    if (!postcode || postcode.trim().length < 3 || !selectedCountry) {
      console.log('🌍 Auto-lookup skipped: missing postcode or country');
      return;
    }

    console.log('🌍 Starting city lookup...');
    setIsDetectingCountry(true);
    
    // Normalize postcode
    const normalizedPostcode = postcode.trim().replace(/\s+/g, '');
    
    // Country to ISO code mapping
    const countryIsoMap: { [key: string]: string } = {
      'United Kingdom': 'gb',
      'United States': 'us',
      'Canada': 'ca',
      'Australia': 'au',
      'Germany': 'de',
      'France': 'fr',
      'Spain': 'es',
      'Italy': 'it',
      'Netherlands': 'nl',
      'Ireland': 'ie',
      'Belgium': 'be',
      'Switzerland': 'ch',
      'Austria': 'at',
      'Poland': 'pl',
      'Portugal': 'pt',
      'Czech Republic': 'cz',
      'Denmark': 'dk',
      'Sweden': 'se',
      'Norway': 'no',
      'Finland': 'fi',
      'Greece': 'gr',
      'Hungary': 'hu',
      'Romania': 'ro',
      'Bulgaria': 'bg',
      'Croatia': 'hr',
      'Slovakia': 'sk',
      'Slovenia': 'si',
      'Lithuania': 'lt',
      'Latvia': 'lv',
      'Estonia': 'ee',
      'Luxembourg': 'lu',
      'Malta': 'mt',
      'Cyprus': 'cy',
      'Iceland': 'is',
      'New Zealand': 'nz',
    };
    
    try {
      // UK-specific lookup using Postcodes.io
      if (selectedCountry === 'United Kingdom') {
        const ukResponse = await fetch(`https://api.postcodes.io/postcodes/${encodeURIComponent(postcode.trim())}`);
        
        if (ukResponse.ok) {
          const ukData = await ukResponse.json();
          
          if (ukData.status === 200 && ukData.result) {
            const result = ukData.result;
            console.log('🌍 ✅ UK Postcode found:', result);
            
            // Set City/Town with state format: "City, State"
            const city = result.admin_district || result.parliamentary_constituency || '';
            const state = result.region || result.county || '';
            
            if (city && state) {
              form.setValue("address.city", `${city}, ${state}`);
              console.log(`🌍 City/State detected: ${city}, ${state}`);
            } else if (city) {
              form.setValue("address.city", city);
              console.log(`🌍 City detected: ${city}`);
            }
            
            setIsDetectingCountry(false);
            return;
          }
        }
      }
      
      // Other countries using Zippopotam.us
      const isoCode = countryIsoMap[selectedCountry];
      if (isoCode) {
        const response = await fetch(`https://api.zippopotam.us/${isoCode}/${normalizedPostcode}`);
        
        if (response.ok) {
          const data = await response.json();
          console.log(`🌍 ✅ Postcode found for ${selectedCountry}:`, data);
          
          // Set City/Town with state format: "City, State"
          if (data.places && data.places.length > 0) {
            const city = data.places[0]['place name'] || '';
            const state = data.places[0]['state'] || '';
            
            if (city && state) {
              form.setValue("address.city", `${city}, ${state}`);
              console.log(`🌍 City/State detected: ${city}, ${state}`);
            } else if (city) {
              form.setValue("address.city", city);
              console.log(`🌍 City detected: ${city}`);
            }
          }
        } else {
          console.log(`🌍 ❌ No match found for postcode: ${normalizedPostcode} in ${selectedCountry}`);
        }
      }
    } catch (error) {
      console.log('🌍 ❌ Lookup error:', error);
    } finally {
      setIsDetectingCountry(false);
    }
  };
  
  // NHS Number validation function - only allows 10 digits
  const validateNHSNumber = (nhsNumber: string): boolean => {
    if (!nhsNumber) {
      setNhsNumberError("");
      return true; // Empty is valid (optional field)
    }

    // Strip any dashes, spaces, or non-numeric characters
    const cleanedNumber = nhsNumber.replace(/[^0-9]/g, '');
    
    // Must be exactly 10 digits
    if (cleanedNumber.length !== 10) {
      setNhsNumberError("Must contain exactly 10 digits");
      return false;
    }
    
    // Check if it contains only digits
    if (!/^\d{10}$/.test(cleanedNumber)) {
      setNhsNumberError("Must contain only numbers");
      return false;
    }
    
    // Valid NHS Number
    setNhsNumberError("");
    return true;
  };
  
  // Email validation function
  const checkEmailAvailability = async (email: string) => {
    if (!email || !email.includes('@')) {
      setEmailValidationStatus('idle');
      return;
    }
    
    // If editing and email hasn't changed, mark as available
    if (editingUser && editingUser.email.toLowerCase() === email.toLowerCase()) {
      setEmailValidationStatus('available');
      return;
    }
    
    try {
      setEmailValidationStatus('checking');
      const response = await apiRequest("GET", "/api/users");
      const userData = await response.json();
      
      // Check if email exists in users (excluding the current user being edited)
      const existingUser = userData.find((user: any) => 
        user.email && user.email.toLowerCase() === email.toLowerCase() && 
        (!editingUser || user.id !== editingUser.id)
      );
      
      if (existingUser) {
        setEmailValidationStatus('exists');
      } else {
        setEmailValidationStatus('available');
      }
    } catch (error) {
      console.error("Error checking email availability:", error);
      setEmailValidationStatus('idle');
    }
  };

  // Debounced email check function
  const handleEmailChange = (email: string) => {
    // Clear existing timeout
    if (emailCheckTimeout) {
      clearTimeout(emailCheckTimeout);
    }
    
    // Reset validation status if email is empty
    if (!email) {
      setEmailValidationStatus('idle');
      return;
    }
    
    // Set new timeout for delayed check
    const timeout = setTimeout(() => {
      checkEmailAvailability(email);
    }, 800); // 800ms delay
    
    setEmailCheckTimeout(timeout);
  };

  // Debug logging
  console.log("Users query - loading:", isLoading, "error:", error, "users count:", users?.length);
  console.log("Auth token exists:", !!localStorage.getItem('auth_token'));

  // Fetch users on mount
  useEffect(() => {
    fetchUsers();
  }, []);

  const form = useForm<UserFormData>({
    resolver: zodResolver(userSchema),
    defaultValues: {
      email: "",
      firstName: "",
      lastName: "",
      role: "doctor",
      department: "",
      workingDays: ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"],
      workingHours: { start: "09:00", end: "17:00" },
      password: "",
      // Patient defaults
      dateOfBirth: "",
      dobDay: "",
      dobMonth: "",
      dobYear: "",
      phone: "",
      nhsNumber: "",
      genderAtBirth: "",
      address: {
        street: "",
        city: "",
        state: "",
        building: "",
        postcode: "",
        country: "United Kingdom",
      },
      emergencyContact: {
        name: "",
        relationship: "",
        phone: "",
        email: "",
      },
      insuranceInfo: {
        provider: "",
        policyNumber: "",
        memberNumber: "",
        planType: "",
        effectiveDate: "",
      },
    },
  });

  const resetCreateUserFormState = () => {
    setEditingUser(null);
    form.reset();
    setSelectedRole("doctor");
    setSelectedSpecialtyCategory("");
    setSelectedSubSpecialty("");
    setSelectedSpecificArea("");
    setSelectedLabTechSubcategory("");
    setSelectedPharmacistSubcategory("");
    setSelectedOpticianSubcategory("");
    setSelectedParamedicSubcategory("");
    setSelectedPhysiotherapistSubcategory("");
    setSelectedAestheticianSubcategory("");
    setSelectedSampleTakerSubcategory("");
    setDobDay("");
    setDobMonth("");
    setDobYear("");
    setDobErrors({});
    setSelectedPlanType("");
    setPlanTypeOpen(false);
    setInsuranceProvider("");
    setNhsNumberError("");
    setPostcodeLookupMessage("");
    setLookupAddresses([]);
    setSelectedAddressDetails(null);
    setSelectedPhoneCountryCode("+44");
    setSelectedEmergencyPhoneCountryCode("+44");
    setShowPassword(false);
    setEmailValidationStatus('idle');
    if (emailCheckTimeout) {
      clearTimeout(emailCheckTimeout);
      setEmailCheckTimeout(null);
    }
  };

  const currentCountry = form.watch("address.country");
  const currentPostcodeValue = form.watch("address.postcode");

  useEffect(() => {
    if (!isPatientRole) {
      setPostcodeLookupMessage("");
      setLookupAddresses([]);
      setSelectedAddressDetails(null);
    }
  }, [isPatientRole]);

  useEffect(() => {
    if (currentCountry !== "United Kingdom") {
      setPostcodeLookupMessage("");
      setLookupAddresses([]);
      setSelectedAddressDetails(null);
    }
  }, [currentCountry]);

  const applySelectedAddress = async (selection: string) => {
    const cleanedPostcode = selection.split(",").pop()?.trim() || form.getValues("address.postcode") || "";
    setLookupLoading(true);
    try {
      const response = await fetch(`https://api.postcodes.io/postcodes/${encodeURIComponent(cleanedPostcode)}`);
      if (!response.ok) {
        throw new Error("Unable to fetch address details");
      }
      const data = await response.json();
      if (!data.result) throw new Error("Royal Mail returned no results");
      const result = data.result;
      const streetParts = [
        result.line_1,
        result.line_2,
        result.thoroughfare,
        result.dependent_locality,
      ]
        .filter(Boolean)
        .map((part: string) => part.trim())
        .filter(Boolean);
      const streetAddress = streetParts.length ? streetParts.join(", ") : selection;

      form.setValue("address.street", streetAddress);
      form.setValue("address.city", result.post_town || result.admin_district || result.region || "");
      form.setValue("address.state", result.region || result.admin_county || result.admin_district || "");
      form.setValue("address.postcode", result.postcode || cleanedPostcode || "");
      form.setValue("address.country", "United Kingdom");
      form.setValue(
        "address.building",
        result.premise || result.building_name || result.admin_ward || result.line_1 || ""
      );

      setSelectedAddressDetails({
        street: streetAddress,
        city: result.post_town || result.admin_district || result.region || "",
        postcode: result.postcode || cleanedPostcode || "",
        building: result.premise || result.building_name || result.admin_ward || result.line_1 || "",
        district: result.admin_district || result.admin_ward || result.region,
        county: result.admin_county || result.region,
        country: result.country || "United Kingdom",
      });
      setPostcodeLookupMessage("Royal Mail address populated.");
      setLookupAddresses([]);
    } catch (error) {
      console.error("Royal Mail detail error:", error);
      setPostcodeLookupMessage("Could not retrieve the full address. Please enter it manually.");
      setSelectedAddressDetails(null);
    } finally {
      setLookupLoading(false);
    }
  };

  const handlePostcodeLookup = async (postcode?: string) => {
    if (!isPatientRole) {
      setPostcodeLookupMessage("Royal Mail lookup is only available for patient records.");
      return;
    }

    const candidatePostcode = (postcode ?? form.getValues("address.postcode") ?? "").trim();
    if (!candidatePostcode || candidatePostcode.length < 3) {
      setPostcodeLookupMessage("Enter a valid postcode before lookup.");
      return;
    }

    const selectedCountry = form.getValues("address.country");
    if (selectedCountry !== "United Kingdom") {
      setPostcodeLookupMessage("Royal Mail lookup is only available for United Kingdom addresses.");
      return;
    }

    setLookupLoading(true);
    setPostcodeLookupMessage("Looking up addresses via Royal Mail...");
    setLookupAddresses([]);
    setSelectedAddressDetails(null);

    try {
      const cleanedPostcode = candidatePostcode.replace(/\s+/g, "");
      const response = await fetch(`https://api.postcodes.io/postcodes/${cleanedPostcode}/autocomplete`);
      if (!response.ok) {
        throw new Error("No addresses found");
      }

      const data = await response.json();
      const results: string[] = data.result ?? [];
      if (results.length === 0) {
        throw new Error("No addresses returned");
      }

      setLookupAddresses(results);
      setPostcodeLookupMessage(`${results.length} address${results.length === 1 ? "" : "es"} returned. Select the precise Royal Mail address.`);
      if (results.length === 1) {
        await applySelectedAddress(results[0]);
      }
    } catch (error) {
      console.error("Lookup error:", error);
      setPostcodeLookupMessage("Unable to fetch addresses. Please enter the address manually or try again.");
    } finally {
      setLookupLoading(false);
    }
  };

  const roleForm = useForm<RoleFormData>({
    resolver: zodResolver(roleSchema) as Resolver<RoleFormData>,
    defaultValues: {
      name: "",
      displayName: "",
      description: "",
      permissions: getInitialPermissions(),
    },
  });

  const openRoleModalForCreate = () => {
    setEditingRole(null);
    roleForm.reset({
      name: "",
      displayName: "",
      description: "",
      permissions: getInitialPermissions(),
    });
    setIsRoleModalOpen(true);
  };

  const modulePermissionValues = roleForm.watch("permissions.modules") || {};

  // Fetch roles with explicit authentication
  const { data: roles = [], isLoading: rolesLoading, error: rolesError } = useQuery({
    queryKey: ["/api/roles"],
    queryFn: async () => {
      const response = await apiRequest("GET", "/api/roles");
      return response.json();
    },
    retry: false,
    staleTime: 30000, // Keep data fresh for 30 seconds to prevent auto-refetch
  });

  // Debug roles data
  console.log("Roles query - loading:", rolesLoading, "error:", rolesError, "roles count:", roles.length);
  if (rolesError) console.log("Roles error details:", rolesError);

  // Role mutations
  const createRoleMutation = useMutation({
    mutationFn: async (data: RoleFormData) => {
      console.log("Sending role data to server:", JSON.stringify(data, null, 2));
      const response = await apiRequest("POST", "/api/roles", data);
      const result = await response.json();
      console.log("Server response:", result);
      return result;
    },
    onSuccess: (newRole) => {
      console.log("Role created successfully, invalidating cache and refetching...");
      queryClient.invalidateQueries({ queryKey: ["/api/roles"] });
      queryClient.refetchQueries({ queryKey: ["/api/roles"] });
      setIsRoleModalOpen(false);
      setEditingRole(null);
      roleForm.reset({
        name: "",
        displayName: "",
        description: "",
        permissions: getInitialPermissions(),
      });
      setSuccessTitle(`Role ${newRole.displayName} created successfully`);
      setSuccessMessage("");
      setShowSuccessModal(true);
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to create role1",
        variant: "destructive",
      });
    },
  });

  const updateRoleMutation = useMutation({
    mutationFn: async (data: RoleFormData & { id: number }) => {
      const response = await apiRequest("PATCH", `/api/roles/${data.id}`, data);
      return response.json();
    },
    onSuccess: async (updatedRole) => {
      // Update the roles list in cache immediately so reopening the modal shows latest data
      queryClient.setQueryData(["/api/roles"], (oldRoles: any) => {
        if (!Array.isArray(oldRoles)) return oldRoles;
        return oldRoles.map((r: any) => r.id === updatedRole.id ? updatedRole : r);
      });
      
      // Also invalidate for safety
      queryClient.invalidateQueries({ queryKey: ["/api/roles"] });
      
      // CRITICAL: Invalidate role permissions cache for all users with this role
      // This ensures permission updates apply immediately
      await queryClient.invalidateQueries({ queryKey: ["/api/roles/by-name", updatedRole.name] });
      
      // Close the Edit Role popup as requested
      setIsRoleModalOpen(false);
      setEditingRole(null);
      
      // Reset form to initial state
      roleForm.reset({
        name: "",
        displayName: "",
        description: "",
        permissions: getInitialPermissions(),
      });
      
      // Show success message
      setSuccessTitle("Role Updated Successfully");
      setSuccessMessage(`The role "${updatedRole.displayName}" has been updated.`);
      setShowSuccessModal(true);
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to update role",
        variant: "destructive",
      });
    },
  });

  const deleteRoleMutation = useMutation({
    mutationFn: async (roleId: number) => {
      await apiRequest("DELETE", `/api/roles/${roleId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/roles"] });
      setSuccessMessage("The role has been deleted successfully.");
      setShowSuccessModal(true);
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to delete role",
        variant: "destructive",
      });
    },
  });

  // Role submission handlers
  const onRoleSubmit: SubmitHandler<RoleFormData> = (data) => {
    // Check if role already exists (only for new roles, not edits)
    if (!editingRole && (roleNameError || roleDisplayNameError)) {
      return;
    }

    const currentPermissions = roleForm.getValues("permissions");
    const normalizedData = {
      ...data,
      permissions: {
        modules: normalizeModulePermissions(currentPermissions.modules),
        fields: normalizeFieldPermissions(currentPermissions.fields),
      },
    };

    if (editingRole) {
      updateRoleMutation.mutate({ ...normalizedData, id: editingRole.id });
    } else {
      createRoleMutation.mutate(normalizedData);
    }
  };

  const handleEditRole = (role: Role) => {
    setEditingRole(role);
    
    // Initialize all modules with template, then merge existing permissions
    const normalizedModules: Record<string, any> = {};
    MODULE_KEYS.forEach((moduleKey) => {
      const existingPerms = role.permissions?.modules?.[moduleKey];
      normalizedModules[moduleKey] = {
        view: existingPerms?.view ?? false,
        create: existingPerms?.create ?? false,
        edit: existingPerms?.edit ?? false,
        delete: existingPerms?.delete ?? false,
      };
    });
    
    // Initialize all fields with template, then merge existing permissions
    const normalizedFields: Record<string, any> = {};
    FIELD_KEYS.forEach((fieldKey) => {
      const existingPerms = role.permissions?.fields?.[fieldKey];
      normalizedFields[fieldKey] = {
        view: existingPerms?.view ?? false,
        edit: existingPerms?.edit ?? false,
      };
    });
    
    roleForm.reset({
      name: role.name,
      displayName: role.displayName,
      description: role.description,
      permissions: {
        modules: normalizedModules,
        fields: normalizedFields,
      },
    });
    setIsRoleModalOpen(true);
  };

  const handleDeleteRole = (roleId: number) => {
    if (!canManageRoles) {
      toast({
        title: "Permission denied",
        description: "Only admin users can delete roles.",
        variant: "destructive",
      });
      return;
    }
    deleteRoleMutation.mutate(roleId);
  };

  const createUserMutation = useMutation({
    mutationFn: async (userData: UserFormData) => {
      // Check subscription limit before creating user
      console.log("Checking subscription limit before user creation...");
      try {
        const limitCheckResponse = await apiRequest("GET", "/api/users/check-subscription-limit");
        const limitData = await limitCheckResponse.json();
        console.log("Subscription limit check:", limitData);
        
        // Role-specific limit validation
        if (userData.role === 'patient') {
          // Check patient limits
          if (limitData.remainingPatients <= 0) {
            throw new Error(
              `Patient limit reached. Your subscription allows ${limitData.maxPatients} patients, and you currently have ${limitData.currentPatientCount} patients. Please upgrade your subscription to add more patients.`
            );
          }
        } else {
          // Check user limits for non-patient roles
          if (limitData.remainingUsers <= 0) {
            throw new Error(
              `User limit reached. Your subscription allows ${limitData.maxUsers} users, and you currently have ${limitData.currentUserCount} users. Please upgrade your subscription to add more users.`
            );
          }
        }
      } catch (error: any) {
        if (error.message.includes("limit reached")) {
          throw error;
        }
        console.warn("Could not check subscription limit:", error);
        // Continue with user creation if we can't check subscription limit
      }

      // If role is patient, check if email already exists in patients table
      if (userData.role === 'patient') {
        console.log("Checking if patient email already exists:", userData.email);
        try {
          const patientsResponse = await apiRequest("GET", "/api/patients");
          const patients = await patientsResponse.json();
          
          // Check if any patient has the same email
          const existingPatient = patients.find((patient: any) => 
            patient.email && patient.email.toLowerCase() === userData.email.toLowerCase()
          );
          
          if (existingPatient) {
            throw new Error("Email already exists in the patients table");
          }
        } catch (error: any) {
          if (error.message === "Email already exists in the patients table") {
            throw error;
          }
          console.warn("Could not check patients table:", error);
          // Continue with user creation if we can't check patients table
        }
      }

      const payload = {
        ...userData,
        username: userData.email, // Use email as username
      };
      console.log("Creating user with payload:", payload);
      
      const response = await apiRequest("POST", "/api/users", payload);
      const result = await response.json();
      console.log("User creation response:", result);
      
      // Patient record creation is now handled automatically by the backend
      if (userData.role === 'patient') {
        console.log("Patient record will be created automatically by backend");
      }
      
      return result;
    },
    onSuccess: async (newUser, variables) => {
      setSuccessTitle("User Created Successfully");
      setSuccessMessage("");
      setShowSuccessModal(true);
      // Immediately add user to list for instant display
      setUsers(prevUsers => [...prevUsers, newUser]);
      // Also fetch fresh data
      refetch();
      setIsCreateModalOpen(false);
      form.reset();
      
      // Send welcome email to the newly created user
      console.log("📧 ATTEMPTING TO SEND WELCOME EMAIL");
      console.log("📧 New user:", newUser);
      console.log("📧 Variables:", variables);
      console.log("📧 Password from variables:", variables.password);
      
      try {
        console.log("📧 Making request to send-welcome-email endpoint");
        const emailResponse = await apiRequest("POST", "/api/users/send-welcome-email", {
          userEmail: newUser.email,
          userName: `${newUser.firstName} ${newUser.lastName}`,
          password: variables.password, // Password from the form submission
          role: newUser.role
        });
        console.log("📧 Email API response:", emailResponse);
        const emailResult = await emailResponse.json();
        console.log("📧 Email API result:", emailResult);
        console.log("✅ Welcome email sent successfully to", newUser.email);
      } catch (emailError) {
        console.error("❌ Failed to send welcome email:", emailError);
        console.error("❌ Email error details:", JSON.stringify(emailError));
        // Don't show error to user - email is a background task
      }
      
      // Redirect to shifts page if role is doctor
      if (newUser.role && (newUser.role.toLowerCase() === 'doctor')) {
        const subdomain = getActiveSubdomain();
        setTimeout(() => {
          setLocation(`/${subdomain}/shifts`);
        }, 1500);
      }
    },
    onError: (error: any) => {
      console.error("User creation error (full):", error);
      console.error("Error message:", error?.message);
      console.error("Error response:", error?.response);
      console.error("Error data:", error?.response?.data);
      
      let errorMessage = "There was a problem creating the user. Please try again.";
      
      // Helper function to clean up validation error messages
      const cleanValidationMessage = (msg: string): string => {
        // Extract field name and make it more readable
        if (msg.includes(':')) {
          const parts = msg.split(':');
          const field = parts[0].trim();
          const message = parts.slice(1).join(':').trim();
          
          // Remove technical details about enum values
          if (message.toLowerCase().includes('invalid enum value')) {
            return `${field.charAt(0).toUpperCase() + field.slice(1)} is invalid`;
          }
          
          // Return field name with capitalized first letter + message
          return `${field.charAt(0).toUpperCase() + field.slice(1)}: ${message}`;
        }
        return msg;
      };
      
      if (error?.response?.data?.error) {
        errorMessage = error.response.data.error;
      } else if (error?.response?.data?.details && Array.isArray(error.response.data.details)) {
        // Clean up validation error messages
        const cleanedMessages = error.response.data.details.map(cleanValidationMessage);
        errorMessage = cleanedMessages.join("\n");
      } else if (error?.message) {
        // Parse error message format like "400: {"error":"Validation failed","details":[...]}"
        if (error.message.includes(": {")) {
          try {
            const jsonPart = error.message.split(": ").slice(1).join(": ");
            const errorObj = JSON.parse(jsonPart);
            
            if (errorObj.error && errorObj.details && Array.isArray(errorObj.details)) {
              // Handle validation errors from JSON message
              const cleanedMessages = errorObj.details.map(cleanValidationMessage);
              errorMessage = cleanedMessages.join("\n");
            } else if (errorObj.error) {
              errorMessage = errorObj.error;
            } else {
              errorMessage = error.message;
            }
          } catch (parseError) {
            errorMessage = error.message;
          }
        } else {
          errorMessage = error.message;
        }
      }
      
      toast({
        title: "Error creating user",
        description: errorMessage,
        variant: "destructive",
      });
    },
  });

  const updateUserMutation = useMutation({
    mutationFn: async ({ id, userData }: { id: number; userData: Partial<UserFormData> }) => {
      const response = await apiRequest("PATCH", `/api/users/${id}`, userData);
      return await response.json();
    },
    onSuccess: (updatedUserData) => {
      setSuccessTitle("User Updated Successfully");
      
      // Format role name: convert underscores to spaces and capitalize each word
      const formatRoleName = (role: string) => {
        return role.split('_').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');
      };
      
      const userName = `${updatedUserData.firstName || ''} ${updatedUserData.lastName || ''}`.trim();
      const roleName = formatRoleName(updatedUserData.role || '');
      setSuccessMessage(`User ${userName} (${roleName}) has been updated successfully`);
      setShowSuccessModal(true);
      
      // Update the form with fresh data from server response
      if (editingUser && updatedUserData) {
        const updatedUser = {
          ...editingUser,
          ...updatedUserData,
          workingDays: updatedUserData.workingDays || [],
          workingHours: updatedUserData.workingHours || { start: "09:00", end: "17:00" }
        };
        setEditingUser(updatedUser);
        
        // Update form with fresh server data
        form.reset({
          email: updatedUserData.email,
          firstName: updatedUserData.firstName,
          lastName: updatedUserData.lastName,
          role: updatedUserData.role as any,
          department: updatedUserData.department || "",
          workingDays: updatedUserData.workingDays || [],
          workingHours: updatedUserData.workingHours || { start: "09:00", end: "17:00" },
          password: "",
        });
      }
      
      refetch();
      setTimeout(() => {
        setEditingUser(null);
        setIsCreateModalOpen(false);
      }, 1500);
    },
    onError: (error: any) => {
      let errorMessage = "There was a problem updating the user. Please try again.";
      
      // Helper function to clean up validation error messages
      const cleanValidationMessage = (msg: string): string => {
        if (msg.includes(':')) {
          const parts = msg.split(':');
          const field = parts[0].trim();
          const message = parts.slice(1).join(':').trim();
          
          if (message.toLowerCase().includes('invalid enum value')) {
            return `${field.charAt(0).toUpperCase() + field.slice(1)} is invalid`;
          }
          
          return `${field.charAt(0).toUpperCase() + field.slice(1)}: ${message}`;
        }
        return msg;
      };
      
      if (error?.response?.data?.error) {
        errorMessage = error.response.data.error;
      } else if (error?.response?.data?.details && Array.isArray(error.response.data.details)) {
        const cleanedMessages = error.response.data.details.map(cleanValidationMessage);
        errorMessage = cleanedMessages.join("\n");
      } else if (error?.message) {
        if (error.message.includes(": {")) {
          try {
            const jsonPart = error.message.split(": ").slice(1).join(": ");
            const errorObj = JSON.parse(jsonPart);
            
            if (errorObj.error && errorObj.details && Array.isArray(errorObj.details)) {
              const cleanedMessages = errorObj.details.map(cleanValidationMessage);
              errorMessage = cleanedMessages.join("\n");
            } else if (errorObj.error) {
              errorMessage = errorObj.error;
            } else {
              errorMessage = error.message;
            }
          } catch (parseError) {
            errorMessage = error.message;
          }
        } else {
          errorMessage = error.message;
        }
      }
      
      toast({
        title: "Error updating user",
        description: errorMessage,
        variant: "destructive",
      });
    },
  });

  const deleteUserMutation = useMutation({
    mutationFn: async (userId: number) => {
      console.log("Deleting user:", userId);
      const response = await apiRequest("DELETE", `/api/users/${userId}`);
      return response.json();
    },
    onSuccess: (data, userId) => {
      const deletionSteps = `The user has been successfully deleted. The following operations were completed:

1. Delete notifications for user
2. Delete prescriptions where user is the doctor (doctorId)
3. Delete appointments where user is provider
4. Delete lab results ordered by user (orderedBy)
5. Delete default shifts for user
6. Delete custom shifts for user
7. Find patient record linked to this user
8. Delete prescriptions FOR this patient (patientId)
9. Delete lab results for this patient (patientId)
10. Delete medical images for this patient (patientId)
11. Delete symptom checks for this patient (patientId)
12. Delete patient record
13. Delete user`;
      
      setSuccessTitle("User Deleted Successfully");
      setSuccessMessage(deletionSteps);
      setShowSuccessModal(true);
      // Immediately remove user from list for instant display
      setUsers(prevUsers => prevUsers.filter(user => user.id !== userId));
      // Also fetch fresh data
      refetch();
    },
    onError: (error) => {
      console.error("Delete user error:", error);
      toast({
        title: "Error deleting user",
        description: "There was a problem deleting the user. Please try again.",
        variant: "destructive",
      });
    },
  });

  const onSubmit = (data: UserFormData) => {
    console.log("📝 FORM SUBMITTED - onSubmit called");
    console.log("  Form data:", data);
    console.log("  Editing user:", editingUser?.id);
    
    // Validate working hours for non-patient roles
    if (data.role !== 'patient') {
      if (!data.workingHours?.start || !data.workingHours?.end) {
        toast({
          title: "Working Hours Required",
          description: "Working hours are required for staff members (admin, doctor, nurse, etc.)",
          variant: "destructive",
        });
        return;
      }
    }
    
    // Validate Date of Birth for patient role
    if (data.role === 'patient') {
      const dobValidationErrors = validateDOB(dobDay, dobMonth, dobYear);
      if (Object.keys(dobValidationErrors).length > 0) {
        toast({
          title: "Invalid Date of Birth",
          description: dobValidationErrors.combined || "Please check the date of birth fields",
          variant: "destructive",
        });
        return;
      }
      
      // Validate NHS Number if Insurance Provider is not Self-Pay
      if (insuranceProvider && insuranceProvider !== "Self-Pay") {
        if (data.nhsNumber && !validateNHSNumber(data.nhsNumber)) {
          toast({
            title: "Invalid NHS Number",
            description: nhsNumberError || "Please enter a valid 10-digit NHS Number with correct check digit",
            variant: "destructive",
          });
          return;
        }
      }
    }
    
    // Include medical specialty fields for doctor-like roles
    const submitData: any = {
      ...data,
      medicalSpecialtyCategory: isDoctorLike(data.role) ? selectedSpecialtyCategory : undefined,
      subSpecialty: isDoctorLike(data.role) ? selectedSubSpecialty : undefined,
    };
    
    // Combine dobDay, dobMonth, dobYear into dateOfBirth for patient role
    if (data.role === 'patient') {
      if (data.dobDay && data.dobMonth && data.dobYear) {
        const day = data.dobDay.padStart(2, '0');
        const month = data.dobMonth.padStart(2, '0');
        submitData.dateOfBirth = `${data.dobYear}-${month}-${day}`;
      } else if (dobDay && dobMonth && dobYear) {
        // Fallback to state variables if form data doesn't have them
        const day = dobDay.padStart(2, '0');
        const month = dobMonth.padStart(2, '0');
        submitData.dateOfBirth = `${dobYear}-${month}-${day}`;
      } else {
        // If no DOB provided, set to null instead of empty string
        submitData.dateOfBirth = null;
      }
      // Clean up the separate fields
      delete submitData.dobDay;
      delete submitData.dobMonth;
      delete submitData.dobYear;
    }
    
    // Remove working hours for patient role
    if (data.role === 'patient') {
      delete submitData.workingHours;
      delete submitData.workingDays;
    }
    
    if (editingUser) {
      // When editing, password is optional - remove if empty
      if (!submitData.password || submitData.password.trim() === '') {
        delete submitData.password;
      }
      console.log("🔄 Calling updateUserMutation");
      updateUserMutation.mutate({ id: editingUser.id, userData: submitData });
    } else {
      // When creating new user, password is required
      if (!submitData.password || submitData.password.trim() === '') {
        toast({
          title: "Password Required",
          description: "Password is required when creating a new user",
          variant: "destructive",
        });
        return;
      }
      createUserMutation.mutate(submitData);
    }
  };

  // NEW SECTIONED EDIT FUNCTIONALITY
  const handleEdit = (user: User) => {
    console.log("🔧 NEW SECTIONED EDIT - User:", user.id, user.email, "Role:", user.role);
    
    setEditingUser(user);
    setSelectedRole(user.role);
    
    // Reset email validation status to available since we're editing existing user
    setEmailValidationStatus('available');
    if (emailCheckTimeout) {
      clearTimeout(emailCheckTimeout);
    }
    
    // SECTION 1: Users table data (applies to all users)
    console.log("📋 SECTION 1: Loading users table data");
    const userData: any = {
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      role: user.role as any,
      department: user.department || "",
      workingDays: user.workingDays || [],
      workingHours: (user.workingHours?.start && user.workingHours?.end) ? user.workingHours : { start: "09:00", end: "17:00" },
      password: "", // Don't pre-fill password for security
    };

    // Set medical specialty fields for doctor-like roles
    if (isDoctorLike(user.role)) {
      setSelectedSpecialtyCategory(user.medicalSpecialtyCategory || "");
      setSelectedSubSpecialty(user.subSpecialty || "");
      userData.medicalSpecialtyCategory = user.medicalSpecialtyCategory || "";
      userData.subSpecialty = user.subSpecialty || "";
    } else {
      setSelectedSpecialtyCategory("");
      setSelectedSubSpecialty("");
    }

    // Set lab technician subcategory for Lab Technician role
    if (['lab technician', 'lab_technician'].includes(user.role.toLowerCase())) {
      setSelectedLabTechSubcategory(user.medicalSpecialtyCategory || "");
      userData.medicalSpecialtyCategory = user.medicalSpecialtyCategory || "";
    } else {
      setSelectedLabTechSubcategory("");
    }

    // Set pharmacist subcategory for Pharmacist role
    if (user.role.toLowerCase() === 'pharmacist') {
      setSelectedPharmacistSubcategory(user.medicalSpecialtyCategory || "");
      userData.medicalSpecialtyCategory = user.medicalSpecialtyCategory || "";
    } else {
      setSelectedPharmacistSubcategory("");
    }

    // Set optician subcategory for Optician role
    if (user.role.toLowerCase() === 'optician') {
      setSelectedOpticianSubcategory(user.medicalSpecialtyCategory || "");
      userData.medicalSpecialtyCategory = user.medicalSpecialtyCategory || "";
    } else {
      setSelectedOpticianSubcategory("");
    }

    // Set paramedic subcategory for Paramedic role
    if (user.role.toLowerCase() === 'paramedic') {
      setSelectedParamedicSubcategory(user.medicalSpecialtyCategory || "");
      userData.medicalSpecialtyCategory = user.medicalSpecialtyCategory || "";
    } else {
      setSelectedParamedicSubcategory("");
    }

    // Set physiotherapist subcategory for Physiotherapist role
    if (user.role.toLowerCase() === 'physiotherapist') {
      setSelectedPhysiotherapistSubcategory(user.medicalSpecialtyCategory || "");
      userData.medicalSpecialtyCategory = user.medicalSpecialtyCategory || "";
    } else {
      setSelectedPhysiotherapistSubcategory("");
    }

    // Set aesthetician subcategory for Aesthetician role
    if (user.role.toLowerCase() === 'aesthetician') {
      setSelectedAestheticianSubcategory(user.medicalSpecialtyCategory || "");
      userData.medicalSpecialtyCategory = user.medicalSpecialtyCategory || "";
    } else {
      setSelectedAestheticianSubcategory("");
    }

    // Set sample taker subcategory for Sample Taker role
    if (user.role.toLowerCase() === 'sample taker') {
      setSelectedSampleTakerSubcategory(user.medicalSpecialtyCategory || "");
      userData.medicalSpecialtyCategory = user.medicalSpecialtyCategory || "";
    } else {
      setSelectedSampleTakerSubcategory("");
    }

    // SECTION 2: Patient table data (if role === 'patient')
    if (user.role === 'patient') {
      console.log("📋 SECTION 2: Loading patients table data (matched by email)");
      userData.dateOfBirth = user.dateOfBirth || "";
      
      // Split dateOfBirth into day, month, year for separate fields
      if (user.dateOfBirth) {
        const dobParts = user.dateOfBirth.split('-');
        if (dobParts.length === 3) {
          userData.dobYear = dobParts[0];
          userData.dobMonth = dobParts[1];
          userData.dobDay = dobParts[2];
          // Set state for DOB dropdowns
          setDobYear(dobParts[0]);
          setDobMonth(dobParts[1]);
          setDobDay(dobParts[2]);
          setDobErrors({});
        }
      } else {
        userData.dobDay = "";
        userData.dobMonth = "";
        userData.dobYear = "";
        setDobDay("");
        setDobMonth("");
        setDobYear("");
        setDobErrors({});
      }
      
      userData.phone = user.phone || "";
      userData.nhsNumber = user.nhsNumber || "";
      userData.genderAtBirth = user.genderAtBirth || "";
      userData.address = {
        street: user.address?.street || "",
        city: user.address?.city || "",
        state: user.address?.state || "",
        postcode: user.address?.postcode || "",
        country: user.address?.country || "United Kingdom",
      };
      userData.emergencyContact = {
        name: user.emergencyContact?.name || "",
        relationship: user.emergencyContact?.relationship || "",
        phone: user.emergencyContact?.phone || "",
        email: user.emergencyContact?.email || "",
      };
      
      // SECTION 3: Insurance verification data (from insurance_verifications table)
      console.log("📋 SECTION 3: Loading insurance_verifications table data (by patient_id)");
      if (user.insuranceVerification) {
        console.log("✅ Insurance verification found:", user.insuranceVerification);
        userData.insuranceInfo = {
          provider: user.insuranceVerification.provider || "",
          policyNumber: user.insuranceVerification.policyNumber || "",
          memberNumber: user.insuranceVerification.memberNumber || "",
          planType: user.insuranceVerification.planType || "",
          effectiveDate: user.insuranceVerification.effectiveDate || "",
        };
        // Set insurance provider state for conditional NHS Number display
        setInsuranceProvider(user.insuranceVerification.provider || "");
        // Set plan type state
        setSelectedPlanType(user.insuranceVerification.planType || "");
      } else {
        console.log("⚠️ No insurance verification found, using insuranceInfo from patients table");
        userData.insuranceInfo = {
          provider: user.insuranceInfo?.provider || "",
          policyNumber: user.insuranceInfo?.policyNumber || "",
          memberNumber: user.insuranceInfo?.memberNumber || "",
          planType: user.insuranceInfo?.planType || "",
          effectiveDate: user.insuranceInfo?.effectiveDate || "",
        };
        // Set insurance provider state for conditional NHS Number display
        setInsuranceProvider(user.insuranceInfo?.provider || "");
        // Set plan type state
        setSelectedPlanType(user.insuranceInfo?.planType || "");
      }
      
      console.log("📊 Complete patient data loaded:", {
        dateOfBirth: userData.dateOfBirth,
        phone: userData.phone,
        nhsNumber: userData.nhsNumber,
        address: userData.address,
        emergencyContact: userData.emergencyContact,
        insuranceInfo: userData.insuranceInfo
      });
    }
    
    form.reset(userData);
    setIsCreateModalOpen(true);
    console.log("✅ NEW SECTIONED EDIT complete - All 3 sections loaded successfully");
  };

  const handleDelete = (userId: number) => {
    deleteUserMutation.mutate(userId);
  };

  const getRoleIcon = (role: string) => {
    switch (role) {
      case "admin":
        return <Shield className="h-4 w-4" />;
      case "doctor":
        return <Stethoscope className="h-4 w-4" />;
      case "nurse":
        return <Users className="h-4 w-4" />;
      case "receptionist":
        return <Calendar className="h-4 w-4" />;
      case "patient":
        return <User className="h-4 w-4" />;
      case "sample_taker":
      case "lab_technician":
        return <TestTube className="h-4 w-4" />;
      default:
        return <Users className="h-4 w-4" />;
    }
  };

  const getRoleColor = (role: string) => {
    switch (role) {
      case "admin":
        return "bg-red-100 text-red-800";
      case "doctor":
        return "bg-blue-100 text-blue-800";
      case "nurse":
        return "bg-green-100 text-green-800";
      case "receptionist":
        return "bg-yellow-100 text-yellow-800";
      case "patient":
        return "bg-purple-100 text-purple-800";
      case "sample_taker":
      case "lab_technician":
        return "bg-cyan-100 text-cyan-800";
      default:
        return "bg-gray-100 text-gray-800";
    }
  };

  const getRoleDisplayName = (role: string) => {
    switch (role) {
      case "admin":
        return "Administrator";
      case "doctor":
        return "Doctor";
      case "nurse":
        return "Nurse";
      case "receptionist":
        return "Receptionist";
      case "patient":
        return "Patient";
      case "sample_taker":
        return "Sample Taker";
      case "lab_technician":
        return "Lab Technician";
      default:
        return role;
    }
  };

  const filteredUsers = users.filter(
    (user) => {
      const matchesSearch = 
        user.firstName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        user.lastName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        user.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
        user.role.toLowerCase().includes(searchTerm.toLowerCase());
      
      const matchesRole = roleFilter === "all" || user.role === roleFilter;
      
      return matchesSearch && matchesRole;
    }
  );
  
  // Group users by role
  const groupedUsers = filteredUsers.reduce((acc, user) => {
    const role = user.role;
    if (!acc[role]) {
      acc[role] = [];
    }
    acc[role].push(user);
    return acc;
  }, {} as Record<string, typeof filteredUsers>);
  
  // Role display names
  const roleDisplayNames: Record<string, string> = {
    admin: "Admins",
    doctor: "Doctors",
    nurse: "Nurses",
    receptionist: "Receptionists",
    patient: "Patients",
    sample_taker: "Sample Takers",
    lab_technician: "Lab Technicians"
  };

  // Debug: Log filtered users to see exactly what's being rendered
  console.log("Filtered users for rendering:", filteredUsers.map(u => ({
    id: u.id,
    email: u.email,
    firstName: u.firstName,
    lastName: u.lastName,
    role: u.role
  })));

  const userCounts = users.reduce((acc, user) => {
    acc[user.role] = (acc[user.role] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 page-full-width">
      <Header title="User Management" subtitle="Manage system users and their permissions" />
      
      <div className="w-full px-4 sm:px-6 lg:px-8 py-8">
        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600 dark:text-gray-300">Total Users</p>
                  <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">{users.length}</p>
                </div>
                <Users className="h-8 w-8 text-blue-600" />
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600 dark:text-gray-300">Doctors</p>
                  <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">{userCounts.doctor || 0}</p>
                </div>
                <Stethoscope className="h-8 w-8 text-blue-600" />
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600 dark:text-gray-300">Nurses</p>
                  <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">{userCounts.nurse || 0}</p>
                </div>
                <Users className="h-8 w-8 text-green-600" />
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600 dark:text-gray-300">Staff</p>
                  <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">{(userCounts.receptionist || 0) + (userCounts.admin || 0)}</p>
                </div>
                <Calendar className="h-8 w-8 text-yellow-600" />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Tab Navigation */}
        <div className="mb-6">
          <div className="border-b border-gray-200">
            <nav className="-mb-px flex space-x-8">
              <button
                onClick={() => setActiveTab("users")}
                className={`py-2 px-1 border-b-2 font-medium text-sm ${
                  activeTab === "users"
                    ? "border-blue-500 text-blue-600"
                    : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
                }`}
              >
                <Users className="h-4 w-4 inline mr-2" />
                User Management
              </button>
              <button
                onClick={() => setActiveTab("roles")}
                className={`py-2 px-1 border-b-2 font-medium text-sm ${
                  activeTab === "roles"
                    ? "border-blue-500 text-blue-600"
                    : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
                }`}
              >
                <Shield className="h-4 w-4 inline mr-2" />
                Role Management
              </button>
            </nav>
          </div>
        </div>

        {activeTab === "users" && (
          <>
            {/* Header and Controls */}
            <div className="flex items-center justify-between mb-6">
          <div className="flex-1 flex gap-3 items-center">
            <Input
              placeholder="Search users by name, email, or role..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="max-w-md"
            />
            <Select value={roleFilter} onValueChange={setRoleFilter}>
              <SelectTrigger className="w-[200px]">
                <SelectValue placeholder="Filter by role" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Roles</SelectItem>
                <SelectItem value="admin">Admins</SelectItem>
                <SelectItem value="doctor">Doctors</SelectItem>
                <SelectItem value="nurse">Nurses</SelectItem>
                <SelectItem value="receptionist">Receptionists</SelectItem>
                <SelectItem value="patient">Patients</SelectItem>
                <SelectItem value="sample_taker">Sample Takers</SelectItem>
                <SelectItem value="lab_technician">Lab Technicians</SelectItem>
              </SelectContent>
            </Select>
          </div>
          
          <div className="flex gap-2">
            {/* View Toggle */}
            <div className="flex border rounded-lg overflow-hidden">
              <Button
                variant={userViewType === "list" ? "default" : "ghost"}
                size="sm"
                onClick={() => setUserViewType("list")}
                className="rounded-none"
                data-testid="button-user-list-view"
              >
                <LayoutList className="h-4 w-4" />
              </Button>
              <Button
                variant={userViewType === "grid" ? "default" : "ghost"}
                size="sm"
                onClick={() => setUserViewType("grid")}
                className="rounded-none"
                data-testid="button-user-grid-view"
              >
                <LayoutGrid className="h-4 w-4" />
              </Button>
            </div>
            
              <Button 
                onClick={() => {
                  resetCreateUserFormState();
                  setIsCreateModalOpen(true);
                }} 
                variant="default" 
                className="flex items-center gap-2 bg-gray-800 text-white hover:bg-gray-700"
              >
              <UserPlus className="h-4 w-4" />
              Add New User
            </Button>
{/* View Role Permissions button hidden
            <Link href={`/${getActiveSubdomain()}/permissions-reference`}>
              <Button variant="outline" className="flex items-center gap-2">
                <BookOpen className="h-4 w-4" />
                View Role Permissions
              </Button>
            </Link>
*/}
          </div>
        </div>
          
          <Dialog open={isCreateModalOpen || !!editingUser} onOpenChange={(open) => {
              if (!open) {
                setIsCreateModalOpen(false);
                resetCreateUserFormState();
              }
            }}>
            <DialogContent className="max-w-6xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>
                  {editingUser ? "Edit User" : "Add New User"}
                </DialogTitle>
                <DialogDescription>
                  {editingUser 
                    ? "Update the user's information and permissions."
                    : "Create a new user account with appropriate role and permissions."
                  }
                </DialogDescription>
                
                {/* Display subscription limit information when creating new user */}
                {!editingUser && (
                  <div className="mt-4 p-4 rounded-lg bg-yellow-50 dark:bg-yellow-950 border border-yellow-200 dark:border-yellow-800">
                    {isLoadingSubscriptionLimit ? (
                      <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
                        <div className="animate-spin h-4 w-4 border-2 border-yellow-600 border-t-transparent rounded-full"></div>
                        Loading subscription details...
                      </div>
                    ) : subscriptionLimitData ? (
                      <div className="space-y-3">
                        <h4 className="text-sm font-semibold text-yellow-900 dark:text-yellow-100">
                          Subscription Status
                        </h4>
                        
                        {/* User Limits */}
                        <div>
                          <h5 className="text-xs font-medium text-gray-700 dark:text-gray-300 mb-2">User Limits</h5>
                          <div className="grid grid-cols-3 gap-4 text-sm">
                            <div>
                              <span className="text-gray-600 dark:text-gray-400">Maximum Users:</span>
                              <span className="ml-2 font-semibold text-yellow-900 dark:text-yellow-100">
                                {subscriptionLimitData.maxUsers}
                              </span>
                            </div>
                            <div>
                              <span className="text-gray-600 dark:text-gray-400">Current Users:</span>
                              <span className="ml-2 font-semibold text-yellow-900 dark:text-yellow-100">
                                {subscriptionLimitData.currentUserCount}
                              </span>
                            </div>
                            <div>
                              <span className="text-gray-600 dark:text-gray-400">Remaining Slots:</span>
                              <span className={`ml-2 font-semibold ${
                                subscriptionLimitData.remainingUsers > 0 
                                  ? 'text-green-600 dark:text-green-400' 
                                  : 'text-red-600 dark:text-red-400'
                              }`}>
                                {subscriptionLimitData.remainingUsers}
                              </span>
                            </div>
                          </div>
                        </div>

                        {/* Patient Limits */}
                        <div className="pt-2 border-t border-yellow-200 dark:border-yellow-800">
                          <h5 className="text-xs font-medium text-gray-700 dark:text-gray-300 mb-2">Patient Limits</h5>
                          <div className="grid grid-cols-3 gap-4 text-sm">
                            <div>
                              <span className="text-gray-600 dark:text-gray-400">Maximum Patients:</span>
                              <span className="ml-2 font-semibold text-yellow-900 dark:text-yellow-100">
                                {subscriptionLimitData.maxPatients}
                              </span>
                            </div>
                            <div>
                              <span className="text-gray-600 dark:text-gray-400">Current Patients:</span>
                              <span className="ml-2 font-semibold text-yellow-900 dark:text-yellow-100">
                                {subscriptionLimitData.currentPatientCount}
                              </span>
                            </div>
                            <div>
                              <span className="text-gray-600 dark:text-gray-400">Remaining Slots:</span>
                              <span className={`ml-2 font-semibold ${
                                subscriptionLimitData.remainingPatients > 0 
                                  ? 'text-green-600 dark:text-green-400' 
                                  : 'text-red-600 dark:text-red-400'
                              }`}>
                                {subscriptionLimitData.remainingPatients}
                              </span>
                            </div>
                          </div>
                        </div>

                        {/* Show warnings based on selected role */}
                        {selectedRole === 'patient' && subscriptionLimitData.remainingPatients <= 0 && (
                          <div className="mt-3 p-3 bg-red-100 dark:bg-red-900 border border-red-300 dark:border-red-700 rounded-md">
                            <p className="text-sm font-medium text-red-900 dark:text-red-100">
                              ⚠️ You have no remaining patient slots. Your subscription allows {subscriptionLimitData.maxPatients} patients, and you currently have {subscriptionLimitData.currentPatientCount} patients. Please upgrade your subscription to add more patients.
                            </p>
                          </div>
                        )}
                        {selectedRole !== 'patient' && subscriptionLimitData.remainingUsers <= 0 && (
                          <div className="mt-3 p-3 bg-red-100 dark:bg-red-900 border border-red-300 dark:border-red-700 rounded-md">
                            <p className="text-sm font-medium text-red-900 dark:text-red-100">
                              ⚠️ You have no remaining user slots. Your subscription allows {subscriptionLimitData.maxUsers} users, and you currently have {subscriptionLimitData.currentUserCount} users. Please upgrade your subscription to add more users.
                            </p>
                          </div>
                        )}
                      </div>
                    ) : (
                      <p className="text-sm text-gray-600 dark:text-gray-400">
                        Unable to load subscription details
                      </p>
                    )}
                  </div>
                )}
              </DialogHeader>
              
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="firstName">First Name</Label>
                    <Input
                      id="firstName"
                      {...form.register("firstName")}
                      minLength={2}
                      maxLength={30}
                      required
                      className={form.formState.errors.firstName ? "border-red-500" : ""}
                    />
                    {form.formState.errors.firstName && (
                      <p className="text-sm text-red-500">{form.formState.errors.firstName.message}</p>
                    )}
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="lastName">Last Name</Label>
                    <Input
                      id="lastName"
                      {...form.register("lastName")}
                      minLength={2}
                      maxLength={30}
                      required
                      className={form.formState.errors.lastName ? "border-red-500" : ""}
                    />
                    {form.formState.errors.lastName && (
                      <p className="text-sm text-red-500">{form.formState.errors.lastName.message}</p>
                    )}
                  </div>
                </div>
                
                {/* Email Address and Role in one row */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="email">Email Address</Label>
                    <Input
                      id="email"
                      type="email"
                      required
                      {...form.register("email", {
                        onChange: (e) => {
                          handleEmailChange(e.target.value);
                        }
                      })}
                      className={form.formState.errors.email ? "border-red-500" : ""}
                    />
                    {form.formState.errors.email && (
                      <p className="text-sm text-red-500">{form.formState.errors.email.message}</p>
                    )}
                    {/* Email availability status */}
                    {emailValidationStatus === 'checking' && (
                      <p className="text-sm text-gray-500">Checking availability...</p>
                    )}
                    {emailValidationStatus === 'available' && (
                      <p className="text-sm text-green-600 flex items-center gap-1">
                        <Check className="h-4 w-4" />
                        Available
                      </p>
                    )}
                    {emailValidationStatus === 'exists' && (
                      <p className="text-sm text-red-600 flex items-center gap-1">
                        <X className="h-4 w-4" />
                        Email already exists
                      </p>
                    )}
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="role">Role</Label>
                    {editingUser ? (
                      // Non-editable role display for edit mode
                      <div className="px-3 py-2 border border-gray-200 dark:border-gray-700 rounded-md bg-gray-50 dark:bg-gray-800">
                        <span className="text-sm font-medium text-gray-900 dark:text-gray-100">
                          {rolesData.find((r: any) => r.name === selectedRole)?.displayName || selectedRole}
                        </span>
                      </div>
                    ) : (
                      // Editable role dropdown for create mode
                      <SearchableSelect
                        open={roleOpen}
                        onOpenChange={setRoleOpen}
                        value={selectedRole}
                        onSelect={(value) => {
                          form.setValue("role", value as any);
                          setSelectedRole(value);
                          // Reset specialty selections when role changes to non-doctor-like role
                          if (!isDoctorLike(value)) {
                            setSelectedSpecialtyCategory("");
                            setSelectedSubSpecialty("");
                            setSelectedSpecificArea("");
                          }
                          // Clear lab tech subcategory when switching from lab technician
                          if (!['lab technician', 'lab_technician'].includes(value.toLowerCase())) {
                            setSelectedLabTechSubcategory("");
                          }
                          // Clear pharmacist subcategory when switching from pharmacist
                          if (value.toLowerCase() !== 'pharmacist') {
                            setSelectedPharmacistSubcategory("");
                          }
                          // Clear optician subcategory when switching from optician
                          if (value.toLowerCase() !== 'optician') {
                            setSelectedOpticianSubcategory("");
                          }
                          // Clear paramedic subcategory when switching from paramedic
                          if (value.toLowerCase() !== 'paramedic') {
                            setSelectedParamedicSubcategory("");
                          }
                          // Clear physiotherapist subcategory when switching from physiotherapist
                          if (value.toLowerCase() !== 'physiotherapist') {
                            setSelectedPhysiotherapistSubcategory("");
                          }
                          // Clear aesthetician subcategory when switching from aesthetician
                          if (value.toLowerCase() !== 'aesthetician') {
                            setSelectedAestheticianSubcategory("");
                          }
                          // Clear sample taker subcategory when switching from sample taker
                          if (value.toLowerCase() !== 'sample taker') {
                            setSelectedSampleTakerSubcategory("");
                          }
                          // Clear plan type when switching from patient
                          if (value.toLowerCase() !== 'patient') {
                            setSelectedPlanType("");
                          }
                        }}
                        options={rolesData
                          .filter((role: any) => {
                            const roleName = (role.name || '').toLowerCase();
                            return !['admin', 'administrator'].includes(roleName);
                          })
                          .map((role: any) => ({
                            value: role.name,
                            label: role.displayName || role.name
                          }))}
                        placeholder="Select a role"
                        searchPlaceholder="Search roles..."
                        testId="role"
                      />
                    )}
                    {form.formState.errors.role && (
                      <p className="text-sm text-red-500">{form.formState.errors.role.message}</p>
                    )}
                  </div>
                </div>

                {/* Doctor Specialty Dropdowns - Only show when role is doctor-like, excluding Lab Technician, Pharmacist, Physiotherapist, Paramedic, Optician, Aesthetician, and Sample Taker */}
                {isDoctorLike(selectedRole) && !['lab technician', 'lab_technician', 'pharmacist', 'physiotherapist', 'paramedic', 'optician', 'aesthetician', 'sample taker'].includes(selectedRole.toLowerCase()) && (
                  <>
                    <div className="space-y-2">
                      <Label htmlFor="specialtyCategory">Medical Specialty Category</Label>
                      <SearchableSelect
                        open={specialtyCategoryOpen}
                        onOpenChange={setSpecialtyCategoryOpen}
                        value={selectedSpecialtyCategory}
                        onSelect={(value) => {
                          setSelectedSpecialtyCategory(value);
                          setSelectedSubSpecialty("");
                          setSelectedSpecificArea("");
                        }}
                        options={Object.keys(medicalSpecialties).map(category => ({
                          value: category,
                          label: category
                        }))}
                        placeholder="Select specialty category"
                        searchPlaceholder="Search specialty categories..."
                        testId="specialty-category"
                      />
                    </div>

                    {selectedSpecialtyCategory && (
                      <div className="space-y-2">
                        <Label htmlFor="subSpecialty">Sub-Specialty</Label>
                        <SearchableSelect
                          open={subSpecialtyOpen}
                          onOpenChange={setSubSpecialtyOpen}
                          value={selectedSubSpecialty}
                          onSelect={(value) => {
                            setSelectedSubSpecialty(value);
                            setSelectedSpecificArea("");
                          }}
                          options={Object.keys(medicalSpecialties[selectedSpecialtyCategory as keyof typeof medicalSpecialties] || {}).map(subSpecialty => ({
                            value: subSpecialty,
                            label: subSpecialty
                          }))}
                          placeholder="Select sub-specialty"
                          searchPlaceholder="Search sub-specialties..."
                          testId="sub-specialty"
                        />
                      </div>
                    )}

                    {selectedSubSpecialty && selectedSpecialtyCategory && (
                      <div className="space-y-2">
                        <Label htmlFor="specificArea">Specific Area</Label>
                        <SearchableSelect
                          open={specificAreaOpen}
                          onOpenChange={setSpecificAreaOpen}
                          value={selectedSpecificArea}
                          onSelect={setSelectedSpecificArea}
                          options={
                            selectedSpecialtyCategory && selectedSubSpecialty && 
                            medicalSpecialties[selectedSpecialtyCategory as keyof typeof medicalSpecialties] &&
                            medicalSpecialties[selectedSpecialtyCategory as keyof typeof medicalSpecialties][selectedSubSpecialty as keyof typeof medicalSpecialties[keyof typeof medicalSpecialties]] ?
                            (medicalSpecialties[selectedSpecialtyCategory as keyof typeof medicalSpecialties][selectedSubSpecialty as keyof typeof medicalSpecialties[keyof typeof medicalSpecialties]] as string[]).map((area: string) => ({
                              value: area,
                              label: area
                            })) : []
                          }
                          placeholder="Select specific area"
                          searchPlaceholder="Search specific areas..."
                          testId="specific-area"
                        />
                      </div>
                    )}
                  </>
                )}

                {/* Lab Technician Subcategory Dropdown - Only show when role is Lab Technician */}
                {['lab technician', 'lab_technician'].includes(selectedRole.toLowerCase()) && (
                  <div className="space-y-2">
                    <Label htmlFor="labTechSubcategory">Lab Technician Subcategory</Label>
                    <Popover open={labTechSubcategoryOpen} onOpenChange={setLabTechSubcategoryOpen}>
                      <PopoverTrigger asChild>
                        <Button
                          variant="outline"
                          role="combobox"
                          aria-expanded={labTechSubcategoryOpen}
                          className="w-full justify-between font-normal"
                          data-testid="button-lab-tech-subcategory"
                        >
                          <span className={selectedLabTechSubcategory ? "text-foreground" : "text-muted-foreground"}>
                            {selectedLabTechSubcategory || "Select or type subcategory..."}
                          </span>
                          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-full p-0" align="start">
                        <Command>
                          <CommandInput 
                            placeholder="Search or type subcategory..." 
                            onValueChange={(value) => {
                              setSelectedLabTechSubcategory(value);
                              form.setValue("medicalSpecialtyCategory", value, { shouldDirty: true });
                            }}
                            data-testid="command-input-lab-tech-subcategory"
                          />
                          <CommandList>
                            <CommandEmpty>
                              <div className="py-2 px-3 text-sm">
                                <p className="text-muted-foreground mb-2">No subcategory found.</p>
                                <p className="text-xs text-muted-foreground">
                                  Press Enter to use: <span className="font-medium">{selectedLabTechSubcategory}</span>
                                </p>
                              </div>
                            </CommandEmpty>
                            <CommandGroup>
                              {labTechnicianSubcategories.map((subcategory) => (
                                <CommandItem
                                  key={subcategory}
                                  value={subcategory}
                                  onSelect={(currentValue) => {
                                    setSelectedLabTechSubcategory(currentValue);
                                    form.setValue("medicalSpecialtyCategory", currentValue, { shouldDirty: true });
                                    setLabTechSubcategoryOpen(false);
                                  }}
                                  data-testid={`command-item-lab-tech-${subcategory.toLowerCase().replace(/\s+/g, '-')}`}
                                >
                                  <Check
                                    className={`mr-2 h-4 w-4 ${selectedLabTechSubcategory === subcategory ? "opacity-100" : "opacity-0"}`}
                                  />
                                  {subcategory}
                                </CommandItem>
                              ))}
                            </CommandGroup>
                          </CommandList>
                        </Command>
                      </PopoverContent>
                    </Popover>
                  </div>
                )}

                {/* Pharmacist Subcategory Dropdown - Only show when role is Pharmacist */}
                {selectedRole.toLowerCase() === 'pharmacist' && (
                  <div className="space-y-2">
                    <Label htmlFor="pharmacistSubcategory">Pharmacist Subcategory</Label>
                    <Popover open={pharmacistSubcategoryOpen} onOpenChange={setPharmacistSubcategoryOpen}>
                      <PopoverTrigger asChild>
                        <Button
                          variant="outline"
                          role="combobox"
                          aria-expanded={pharmacistSubcategoryOpen}
                          className="w-full justify-between font-normal"
                          data-testid="button-pharmacist-subcategory"
                        >
                          <span className={selectedPharmacistSubcategory ? "text-foreground" : "text-muted-foreground"}>
                            {selectedPharmacistSubcategory || "Select or type subcategory..."}
                          </span>
                          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-full p-0" align="start">
                        <Command>
                          <CommandInput 
                            placeholder="Search or type subcategory..." 
                            onValueChange={(value) => {
                              setSelectedPharmacistSubcategory(value);
                              form.setValue("medicalSpecialtyCategory", value, { shouldDirty: true });
                            }}
                            data-testid="command-input-pharmacist-subcategory"
                          />
                          <CommandList>
                            <CommandEmpty>
                              <div className="py-2 px-3 text-sm">
                                <p className="text-muted-foreground mb-2">No subcategory found.</p>
                                <p className="text-xs text-muted-foreground">
                                  Press Enter to use: <span className="font-medium">{selectedPharmacistSubcategory}</span>
                                </p>
                              </div>
                            </CommandEmpty>
                            <CommandGroup>
                              {pharmacistSubcategories.map((subcategory) => (
                                <CommandItem
                                  key={subcategory}
                                  value={subcategory}
                                  onSelect={(currentValue) => {
                                    setSelectedPharmacistSubcategory(currentValue);
                                    form.setValue("medicalSpecialtyCategory", currentValue, { shouldDirty: true });
                                    setPharmacistSubcategoryOpen(false);
                                  }}
                                  data-testid={`command-item-pharmacist-${subcategory.toLowerCase().replace(/\s+/g, '-')}`}
                                >
                                  <Check
                                    className={`mr-2 h-4 w-4 ${selectedPharmacistSubcategory === subcategory ? "opacity-100" : "opacity-0"}`}
                                  />
                                  {subcategory}
                                </CommandItem>
                              ))}
                            </CommandGroup>
                          </CommandList>
                        </Command>
                      </PopoverContent>
                    </Popover>
                  </div>
                )}

                {/* Optician Subcategory Dropdown - Only show when role is Optician */}
                {selectedRole.toLowerCase() === 'optician' && (
                  <div className="space-y-2">
                    <Label htmlFor="opticianSubcategory">Optician Subcategory</Label>
                    <Popover open={opticianSubcategoryOpen} onOpenChange={setOpticianSubcategoryOpen}>
                      <PopoverTrigger asChild>
                        <Button
                          variant="outline"
                          role="combobox"
                          aria-expanded={opticianSubcategoryOpen}
                          className="w-full justify-between font-normal"
                          data-testid="button-optician-subcategory"
                        >
                          <span className={selectedOpticianSubcategory ? "text-foreground" : "text-muted-foreground"}>
                            {selectedOpticianSubcategory || "Select or type subcategory..."}
                          </span>
                          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-full p-0" align="start">
                        <Command>
                          <CommandInput 
                            placeholder="Search or type subcategory..." 
                            onValueChange={(value) => {
                              setSelectedOpticianSubcategory(value);
                              form.setValue("medicalSpecialtyCategory", value, { shouldDirty: true });
                            }}
                            data-testid="command-input-optician-subcategory"
                          />
                          <CommandList>
                            <CommandEmpty>
                              <div className="py-2 px-3 text-sm">
                                <p className="text-muted-foreground mb-2">No subcategory found.</p>
                                <p className="text-xs text-muted-foreground">
                                  Press Enter to use: <span className="font-medium">{selectedOpticianSubcategory}</span>
                                </p>
                              </div>
                            </CommandEmpty>
                            <CommandGroup>
                              {opticianSubcategories.map((subcategory) => (
                                <CommandItem
                                  key={subcategory}
                                  value={subcategory}
                                  onSelect={(currentValue) => {
                                    setSelectedOpticianSubcategory(currentValue);
                                    form.setValue("medicalSpecialtyCategory", currentValue, { shouldDirty: true });
                                    setOpticianSubcategoryOpen(false);
                                  }}
                                  data-testid={`command-item-optician-${subcategory.toLowerCase().replace(/\s+/g, '-')}`}
                                >
                                  <Check
                                    className={`mr-2 h-4 w-4 ${selectedOpticianSubcategory === subcategory ? "opacity-100" : "opacity-0"}`}
                                  />
                                  {subcategory}
                                </CommandItem>
                              ))}
                            </CommandGroup>
                          </CommandList>
                        </Command>
                      </PopoverContent>
                    </Popover>
                  </div>
                )}

                {/* Paramedic Subcategory Dropdown - Only show when role is Paramedic */}
                {selectedRole.toLowerCase() === 'paramedic' && (
                  <div className="space-y-2">
                    <Label htmlFor="paramedicSubcategory">Paramedic Subcategory</Label>
                    <Popover open={paramedicSubcategoryOpen} onOpenChange={setParamedicSubcategoryOpen}>
                      <PopoverTrigger asChild>
                        <Button
                          variant="outline"
                          role="combobox"
                          aria-expanded={paramedicSubcategoryOpen}
                          className="w-full justify-between font-normal"
                          data-testid="button-paramedic-subcategory"
                        >
                          <span className={selectedParamedicSubcategory ? "text-foreground" : "text-muted-foreground"}>
                            {selectedParamedicSubcategory || "Select or type subcategory..."}
                          </span>
                          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-full p-0" align="start">
                        <Command>
                          <CommandInput 
                            placeholder="Search or type subcategory..." 
                            onValueChange={(value) => {
                              setSelectedParamedicSubcategory(value);
                              form.setValue("medicalSpecialtyCategory", value, { shouldDirty: true });
                            }}
                            data-testid="command-input-paramedic-subcategory"
                          />
                          <CommandList>
                            <CommandEmpty>
                              <div className="py-2 px-3 text-sm">
                                <p className="text-muted-foreground mb-2">No subcategory found.</p>
                                <p className="text-xs text-muted-foreground">
                                  Press Enter to use: <span className="font-medium">{selectedParamedicSubcategory}</span>
                                </p>
                              </div>
                            </CommandEmpty>
                            <CommandGroup>
                              {paramedicSubcategories.map((subcategory) => (
                                <CommandItem
                                  key={subcategory}
                                  value={subcategory}
                                  onSelect={(currentValue) => {
                                    setSelectedParamedicSubcategory(currentValue);
                                    form.setValue("medicalSpecialtyCategory", currentValue, { shouldDirty: true });
                                    setParamedicSubcategoryOpen(false);
                                  }}
                                  data-testid={`command-item-paramedic-${subcategory.toLowerCase().replace(/\s+/g, '-')}`}
                                >
                                  <Check
                                    className={`mr-2 h-4 w-4 ${selectedParamedicSubcategory === subcategory ? "opacity-100" : "opacity-0"}`}
                                  />
                                  {subcategory}
                                </CommandItem>
                              ))}
                            </CommandGroup>
                          </CommandList>
                        </Command>
                      </PopoverContent>
                    </Popover>
                  </div>
                )}

                {/* Physiotherapist Subcategory Dropdown - Only show when role is Physiotherapist */}
                {selectedRole.toLowerCase() === 'physiotherapist' && (
                  <div className="space-y-2">
                    <Label htmlFor="physiotherapistSubcategory">Physiotherapist Subcategory</Label>
                    <Popover open={physiotherapistSubcategoryOpen} onOpenChange={setPhysiotherapistSubcategoryOpen}>
                      <PopoverTrigger asChild>
                        <Button
                          variant="outline"
                          role="combobox"
                          aria-expanded={physiotherapistSubcategoryOpen}
                          className="w-full justify-between font-normal"
                          data-testid="button-physiotherapist-subcategory"
                        >
                          <span className={selectedPhysiotherapistSubcategory ? "text-foreground" : "text-muted-foreground"}>
                            {selectedPhysiotherapistSubcategory || "Select or type subcategory..."}
                          </span>
                          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-full p-0" align="start">
                        <Command>
                          <CommandInput 
                            placeholder="Search or type subcategory..." 
                            onValueChange={(value) => {
                              setSelectedPhysiotherapistSubcategory(value);
                              form.setValue("medicalSpecialtyCategory", value, { shouldDirty: true });
                            }}
                            data-testid="command-input-physiotherapist-subcategory"
                          />
                          <CommandList>
                            <CommandEmpty>
                              <div className="py-2 px-3 text-sm">
                                <p className="text-muted-foreground mb-2">No subcategory found.</p>
                                <p className="text-xs text-muted-foreground">
                                  Press Enter to use: <span className="font-medium">{selectedPhysiotherapistSubcategory}</span>
                                </p>
                              </div>
                            </CommandEmpty>
                            <CommandGroup>
                              {physiotherapistSubcategories.map((subcategory) => (
                                <CommandItem
                                  key={subcategory}
                                  value={subcategory}
                                  onSelect={(currentValue) => {
                                    setSelectedPhysiotherapistSubcategory(currentValue);
                                    form.setValue("medicalSpecialtyCategory", currentValue, { shouldDirty: true });
                                    setPhysiotherapistSubcategoryOpen(false);
                                  }}
                                  data-testid={`command-item-physiotherapist-${subcategory.toLowerCase().replace(/\s+/g, '-')}`}
                                >
                                  <Check
                                    className={`mr-2 h-4 w-4 ${selectedPhysiotherapistSubcategory === subcategory ? "opacity-100" : "opacity-0"}`}
                                  />
                                  {subcategory}
                                </CommandItem>
                              ))}
                            </CommandGroup>
                          </CommandList>
                        </Command>
                      </PopoverContent>
                    </Popover>
                  </div>
                )}

                {/* Aesthetician Subcategory Dropdown - Only show when role is Aesthetician */}
                {selectedRole.toLowerCase() === 'aesthetician' && (
                  <div className="space-y-2">
                    <Label htmlFor="aestheticianSubcategory">Aesthetician Subcategory</Label>
                    <Popover open={aestheticianSubcategoryOpen} onOpenChange={setAestheticianSubcategoryOpen}>
                      <PopoverTrigger asChild>
                        <Button
                          variant="outline"
                          role="combobox"
                          aria-expanded={aestheticianSubcategoryOpen}
                          className="w-full justify-between font-normal"
                          data-testid="button-aesthetician-subcategory"
                        >
                          <span className={selectedAestheticianSubcategory ? "text-foreground" : "text-muted-foreground"}>
                            {selectedAestheticianSubcategory || "Select or type subcategory..."}
                          </span>
                          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-full p-0" align="start">
                        <Command>
                          <CommandInput 
                            placeholder="Search or type subcategory..." 
                            onValueChange={(value) => {
                              setSelectedAestheticianSubcategory(value);
                              form.setValue("medicalSpecialtyCategory", value, { shouldDirty: true });
                            }}
                            data-testid="command-input-aesthetician-subcategory"
                          />
                          <CommandList>
                            <CommandEmpty>
                              <div className="py-2 px-3 text-sm">
                                <p className="text-muted-foreground mb-2">No subcategory found.</p>
                                <p className="text-xs text-muted-foreground">
                                  Press Enter to use: <span className="font-medium">{selectedAestheticianSubcategory}</span>
                                </p>
                              </div>
                            </CommandEmpty>
                            <CommandGroup>
                              {aestheticianSubcategories.map((subcategory) => (
                                <CommandItem
                                  key={subcategory}
                                  value={subcategory}
                                  onSelect={(currentValue) => {
                                    setSelectedAestheticianSubcategory(currentValue);
                                    form.setValue("medicalSpecialtyCategory", currentValue, { shouldDirty: true });
                                    setAestheticianSubcategoryOpen(false);
                                  }}
                                  data-testid={`command-item-aesthetician-${subcategory.toLowerCase().replace(/\s+/g, '-')}`}
                                >
                                  <Check
                                    className={`mr-2 h-4 w-4 ${selectedAestheticianSubcategory === subcategory ? "opacity-100" : "opacity-0"}`}
                                  />
                                  {subcategory}
                                </CommandItem>
                              ))}
                            </CommandGroup>
                          </CommandList>
                        </Command>
                      </PopoverContent>
                    </Popover>
                  </div>
                )}

                {/* Sample Taker Subcategory Dropdown - Only show when role is Sample Taker */}
                {selectedRole.toLowerCase() === 'sample taker' && (
                  <div className="space-y-2">
                    <Label htmlFor="sampleTakerSubcategory">Sample Taker Subcategory</Label>
                    <Select 
                      onValueChange={(value) => {
                        setSelectedSampleTakerSubcategory(value);
                        form.setValue("medicalSpecialtyCategory", value);
                      }} 
                      value={selectedSampleTakerSubcategory}
                    >
                      <SelectTrigger data-testid="dropdown-sample-taker-subcategory">
                        <SelectValue placeholder="Select subcategory" />
                      </SelectTrigger>
                      <SelectContent>
                        {sampleTakerSubcategories.map((subcategory) => (
                          <SelectItem key={subcategory} value={subcategory}>
                            {subcategory}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}

                {/* Patient-specific fields */}
                {selectedRole === 'patient' && (
                  <>
                    <div className="bg-green-50 dark:bg-green-900/20 p-4 rounded-lg border border-green-200 dark:border-green-800">
                      <h4 className="font-medium text-green-900 dark:text-green-100 mb-2">Patient Information</h4>
                      <p className="text-sm text-green-700 dark:text-green-300">Additional fields required for patient accounts</p>
                    </div>

                    {/* Basic Information - Date of Birth and Phone Number in one row */}
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label>Date of Birth</Label>
                        <div className="grid grid-cols-3 gap-2">
                          <div className="space-y-1">
                            <Select 
                              onValueChange={handleDobDayChange}
                              value={dobDay}
                            >
                              <SelectTrigger data-testid="dropdown-dob-day">
                                <SelectValue placeholder="Day" />
                              </SelectTrigger>
                              <SelectContent>
                                {getDayOptions().map((day) => (
                                  <SelectItem key={day} value={day.toString()}>
                                    {day}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                            {dobErrors.day && (
                              <p className="text-xs text-red-500">{dobErrors.day}</p>
                            )}
                          </div>
                          <div className="space-y-1">
                            <Select 
                              onValueChange={handleDobMonthChange}
                              value={dobMonth}
                            >
                              <SelectTrigger data-testid="dropdown-dob-month">
                                <SelectValue placeholder="Month" />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="1">January</SelectItem>
                                <SelectItem value="2">February</SelectItem>
                                <SelectItem value="3">March</SelectItem>
                                <SelectItem value="4">April</SelectItem>
                                <SelectItem value="5">May</SelectItem>
                                <SelectItem value="6">June</SelectItem>
                                <SelectItem value="7">July</SelectItem>
                                <SelectItem value="8">August</SelectItem>
                                <SelectItem value="9">September</SelectItem>
                                <SelectItem value="10">October</SelectItem>
                                <SelectItem value="11">November</SelectItem>
                                <SelectItem value="12">December</SelectItem>
                              </SelectContent>
                            </Select>
                            {dobErrors.month && (
                              <p className="text-xs text-red-500">{dobErrors.month}</p>
                            )}
                          </div>
                          <div className="space-y-1">
                            <Select 
                              onValueChange={handleDobYearChange}
                              value={dobYear}
                            >
                              <SelectTrigger data-testid="dropdown-dob-year">
                                <SelectValue placeholder="Year" />
                              </SelectTrigger>
                              <SelectContent>
                                {Array.from({ length: new Date().getFullYear() - 1900 + 1 }, (_, i) => new Date().getFullYear() - i).map((year) => (
                                  <SelectItem key={year} value={year.toString()}>
                                    {year}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                            {dobErrors.year && (
                              <p className="text-xs text-red-500">{dobErrors.year}</p>
                            )}
                          </div>
                        </div>
                        {dobErrors.combined && (
                          <p className="text-sm text-red-500">{dobErrors.combined}</p>
                        )}
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="phone">Phone Number</Label>
                        <div className="flex gap-2">
                          <Popover open={countryCodePopoverOpen} onOpenChange={setCountryCodePopoverOpen}>
                            <PopoverTrigger asChild>
                              <Button
                                variant="outline"
                                role="combobox"
                                aria-expanded={countryCodePopoverOpen}
                                className="w-[180px] justify-between"
                                data-testid="button-country-code"
                              >
                                <div className="flex items-center gap-2">
                                  <img 
                                    src={`https://flagcdn.com/16x12/${COUNTRY_CODES.find(c => c.code === selectedPhoneCountryCode)?.iso}.png`}
                                    alt={COUNTRY_CODES.find(c => c.code === selectedPhoneCountryCode)?.name}
                                    className="w-4 h-3"
                                    onError={(e) => {
                                      e.currentTarget.style.display = 'none';
                                    }}
                                  />
                                  <span>{selectedPhoneCountryCode}</span>
                                </div>
                                <span className="ml-2 h-4 w-4 shrink-0 opacity-50">▼</span>
                              </Button>
                            </PopoverTrigger>
                            <PopoverContent className="w-[300px] p-0" align="start">
                              <Command>
                                <CommandInput placeholder="Search country..." />
                                <CommandList>
                                  <CommandEmpty>No country found.</CommandEmpty>
                                  <CommandGroup>
                                    {COUNTRY_CODES.map((country, index) => (
                                      <CommandItem
                                        key={`${country.code}-${country.iso}-${index}`}
                                        value={`${country.name} ${country.code}`}
                                        onSelect={() => {
                                          const phoneWithoutCode = form.watch("phone")?.startsWith(selectedPhoneCountryCode) 
                                            ? form.watch("phone")?.slice(selectedPhoneCountryCode.length).trim() 
                                            : form.watch("phone") || "";
                                          setSelectedPhoneCountryCode(country.code);
                                          form.setValue("phone", phoneWithoutCode ? `${country.code} ${phoneWithoutCode}` : "");
                                          setCountryCodePopoverOpen(false);
                                        }}
                                        className="cursor-pointer"
                                      >
                                        <div className="flex items-center gap-2">
                                          <img 
                                            src={`https://flagcdn.com/16x12/${country.iso}.png`}
                                            alt={country.name}
                                            className="w-4 h-3"
                                            onError={(e) => {
                                              e.currentTarget.style.display = 'none';
                                            }}
                                          />
                                          <span className="flex-1">{country.name}</span>
                                          <span className="text-muted-foreground">{country.code}</span>
                                        </div>
                                      </CommandItem>
                                    ))}
                                  </CommandGroup>
                                </CommandList>
                              </Command>
                            </PopoverContent>
                          </Popover>
                          <Input
                            id="phone"
                            type="tel"
                            className="flex-1"
                            placeholder="123 456 7890"
                            data-testid="input-phone"
                            maxLength={COUNTRY_DIGIT_LIMITS[selectedPhoneCountryCode] || 15}
                            value={
                              form.watch("phone")?.startsWith(selectedPhoneCountryCode)
                                ? form.watch("phone")?.slice(selectedPhoneCountryCode.length).trim()
                                : form.watch("phone") || ""
                            }
                            onChange={(e) => {
                              let value = e.target.value.replace(/[^\d]/g, '');
                              const maxDigits = COUNTRY_DIGIT_LIMITS[selectedPhoneCountryCode] || 15;
                              
                              // Limit to max digits for selected country
                              if (value.length > maxDigits) {
                                value = value.slice(0, maxDigits);
                              }
                              
                              form.setValue("phone", value ? `${selectedPhoneCountryCode} ${value}` : "");
                            }}
                          />
                        </div>
                        <p className="text-xs text-gray-500 mt-1">
                          Must be exactly {COUNTRY_DIGIT_LIMITS[selectedPhoneCountryCode]} digits (excluding country code)
                        </p>
                        {form.formState.errors.phone && (
                          <p className="text-sm text-red-500">{form.formState.errors.phone.message}</p>
                        )}
                      </div>
                    </div>

                    {/* Gender at Birth field */}
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="genderAtBirth">Gender at Birth</Label>
                        <Select 
                          onValueChange={(value) => form.setValue("genderAtBirth", value)}
                          value={form.watch("genderAtBirth") || ""}
                          required
                        >
                          <SelectTrigger data-testid="dropdown-gender-at-birth">
                            <SelectValue placeholder="Select gender..." />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="Male">Male</SelectItem>
                            <SelectItem value="Female">Female</SelectItem>
                          </SelectContent>
                        </Select>
                        {form.formState.errors.genderAtBirth && (
                          <p className="text-sm text-red-500">{form.formState.errors.genderAtBirth.message}</p>
                        )}
                      </div>
                    </div>

                    {/* Address Information */}
                    <div className="p-4 rounded-lg border border-gray-200 dark:border-gray-700">
                      <h5 className="font-medium text-blue-600 dark:text-blue-400 mb-4">Address Information</h5>
                      <div className="space-y-4">
                        {/* Country FIRST - Step 1 */}
                        <div className="space-y-2">
                          <Label htmlFor="country">Country</Label>
                          <Select 
                            onValueChange={(value) => {
                              form.setValue("address.country", value);
                              // Re-fetch city if postal code is already entered
                              const currentPostcode = form.watch("address.postcode");
                              if (currentPostcode && currentPostcode.trim().length >= 3) {
                                setTimeout(() => {
                                  detectCountryFromPostcode(currentPostcode);
                                }, 100);
                              }
                            }} 
                            value={form.watch("address.country") || "United Kingdom"}
                          >
                            <SelectTrigger data-testid="select-country">
                              <SelectValue placeholder="Select country" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="Pakistan">🇵🇰 Pakistan</SelectItem>
                              <SelectItem value="India">🇮🇳 India</SelectItem>
                              <SelectItem value="United Kingdom">🇬🇧 United Kingdom</SelectItem>
                              <SelectItem value="United States">🇺🇸 United States</SelectItem>
                              <SelectItem value="Canada">🇨🇦 Canada</SelectItem>
                              <SelectItem value="Australia">🇦🇺 Australia</SelectItem>
                              <SelectItem value="Germany">🇩🇪 Germany</SelectItem>
                              <SelectItem value="France">🇫🇷 France</SelectItem>
                              <SelectItem value="Spain">🇪🇸 Spain</SelectItem>
                              <SelectItem value="Italy">🇮🇹 Italy</SelectItem>
                              <SelectItem value="Netherlands">🇳🇱 Netherlands</SelectItem>
                              <SelectItem value="Ireland">🇮🇪 Ireland</SelectItem>
                              <SelectItem value="Belgium">🇧🇪 Belgium</SelectItem>
                              <SelectItem value="Switzerland">🇨🇭 Switzerland</SelectItem>
                              <SelectItem value="Austria">🇦🇹 Austria</SelectItem>
                              <SelectItem value="Poland">🇵🇱 Poland</SelectItem>
                              <SelectItem value="Portugal">🇵🇹 Portugal</SelectItem>
                              <SelectItem value="Czech Republic">🇨🇿 Czech Republic</SelectItem>
                              <SelectItem value="Denmark">🇩🇰 Denmark</SelectItem>
                              <SelectItem value="Sweden">🇸🇪 Sweden</SelectItem>
                              <SelectItem value="Norway">🇳🇴 Norway</SelectItem>
                              <SelectItem value="Finland">🇫🇮 Finland</SelectItem>
                              <SelectItem value="Greece">🇬🇷 Greece</SelectItem>
                              <SelectItem value="Hungary">🇭🇺 Hungary</SelectItem>
                              <SelectItem value="Romania">🇷🇴 Romania</SelectItem>
                              <SelectItem value="Bulgaria">🇧🇬 Bulgaria</SelectItem>
                              <SelectItem value="Croatia">🇭🇷 Croatia</SelectItem>
                              <SelectItem value="Slovakia">🇸🇰 Slovakia</SelectItem>
                              <SelectItem value="Slovenia">🇸🇮 Slovenia</SelectItem>
                              <SelectItem value="Lithuania">🇱🇹 Lithuania</SelectItem>
                              <SelectItem value="Latvia">🇱🇻 Latvia</SelectItem>
                              <SelectItem value="Estonia">🇪🇪 Estonia</SelectItem>
                              <SelectItem value="Luxembourg">🇱🇺 Luxembourg</SelectItem>
                              <SelectItem value="Malta">🇲🇹 Malta</SelectItem>
                              <SelectItem value="Cyprus">🇨🇾 Cyprus</SelectItem>
                              <SelectItem value="Iceland">🇮🇸 Iceland</SelectItem>
                              <SelectItem value="New Zealand">🇳🇿 New Zealand</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        
                        {/* Postcode - Step 2 */}
                        <div className="space-y-2">
                          <Label htmlFor="postcode">Postal Code / ZIP Code (Auto-lookup)</Label>
                          <div className="flex gap-2">
                            <Input
                              id="postcode"
                              {...form.register("address.postcode")}
                              placeholder="Enter postcode"
                              data-testid="input-postcode"
                              className="flex-1"
                              onChange={(e) => {
                                const value = e.target.value;
                                form.setValue("address.postcode", value);
                                
                                // Clear existing timeout
                                if (detectionTimeout) {
                                  clearTimeout(detectionTimeout);
                                }
                                
                                // Debounce: wait 500ms after user stops typing
                                const timeout = setTimeout(() => {
                                  detectCountryFromPostcode(value);
                                }, 500);
                                
                                setDetectionTimeout(timeout);
                              }}
                            />
                            {isPatientRole && (
                              <Button
                                variant="outline"
                                size="sm"
                                className="whitespace-nowrap"
                                onClick={() => handlePostcodeLookup()}
                                disabled={lookupLoading || !currentPostcodeValue?.trim()}
                              >
                                {lookupLoading ? "Looking up..." : "Lookup"}
                              </Button>
                            )}
                          </div>
                          {isDetectingCountry && (
                            <p className="text-xs text-green-600 dark:text-green-400">🌍 Looking up city...</p>
                          )}
                          {isPatientRole && (
                            <div className="space-y-2">
                              {postcodeLookupMessage && (
                                <p className="text-xs text-emerald-600 dark:text-emerald-300">
                                  {postcodeLookupMessage}
                                </p>
                              )}
                              {lookupAddresses.length > 0 && (
                                <div className="space-y-2">
                                  <p className="text-xs text-gray-500">Select the precise Royal Mail address:</p>
                                  <div className="grid gap-2">
                                    {lookupAddresses.map((address) => (
                                      <Button
                                        key={address}
                                        variant="outline"
                                        size="sm"
                                        className="justify-start text-xs"
                                        onClick={() => applySelectedAddress(address)}
                                      >
                                        {address}
                                      </Button>
                                    ))}
                                  </div>
                                </div>
                              )}
                              {selectedAddressDetails && (
                                <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800 dark:border-emerald-700 dark:bg-emerald-950/20 dark:text-emerald-300">
                                  <p className="font-semibold text-emerald-800 dark:text-emerald-300">
                                    Royal Mail address
                                  </p>
                                  {selectedAddressDetails.street && (
                                    <p>{selectedAddressDetails.street}</p>
                                  )}
                                  {selectedAddressDetails.city && (
                                    <p>
                                      <strong>City:</strong> {selectedAddressDetails.city}
                                    </p>
                                  )}
                                  {selectedAddressDetails.county && (
                                    <p>
                                      <strong>County:</strong> {selectedAddressDetails.county}
                                    </p>
                                  )}
                                  {selectedAddressDetails.country && (
                                    <p>
                                      <strong>Country:</strong> {selectedAddressDetails.country}
                                    </p>
                                  )}
                                  {selectedAddressDetails.building && (
                                    <p>
                                      <strong>Building:</strong> {selectedAddressDetails.building}
                                    </p>
                                  )}
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                        
                        {/* Street Address */}
                        <div className="space-y-2">
                          <Label htmlFor="street">Street Address</Label>
                          <Input
                            id="street"
                            {...form.register("address.street")}
                            placeholder="Enter address"
                            data-testid="input-street-address"
                          />
                        </div>
                        
                        {/* City/Town - Step 3 (Auto-filled) */}
                        <div className="space-y-2">
                          <Label htmlFor="city">City/Town</Label>
                          <Input
                            id="city"
                            {...form.register("address.city")}
                            placeholder="Auto-filled from postcode"
                            data-testid="input-city"
                          />
                        </div>
                      </div>
                    </div>

                    {/* Emergency Contact */}
                    <div className="p-4 rounded-lg border border-gray-200 dark:border-gray-700">
                      <h5 className="font-medium text-purple-600 dark:text-purple-400 mb-4">Emergency Contact</h5>
                      <div className="space-y-4">
                        <div className="grid grid-cols-2 gap-4">
                          <div className="space-y-2">
                            <Label htmlFor="emergencyName">Name</Label>
                            <Input
                              id="emergencyName"
                              {...form.register("emergencyContact.name")}
                              minLength={2}
                              maxLength={50}
                              placeholder="Enter name"
                              data-testid="input-emergency-name"
                            />
                            {form.formState.errors.emergencyContact?.name && (
                              <p className="text-sm text-red-500">{form.formState.errors.emergencyContact.name.message}</p>
                            )}
                          </div>
                          <div className="space-y-2">
                            <Label htmlFor="emergencyRelationship">Relationship</Label>
                            <Select 
                              onValueChange={(value) => form.setValue("emergencyContact.relationship", value)} 
                              value={form.watch("emergencyContact.relationship") || ""}
                            >
                              <SelectTrigger data-testid="dropdown-emergency-relationship">
                                <SelectValue placeholder="Select relationship" />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="Father">Father</SelectItem>
                                <SelectItem value="Mother">Mother</SelectItem>
                                <SelectItem value="Son">Son</SelectItem>
                                <SelectItem value="Daughter">Daughter</SelectItem>
                                <SelectItem value="Brother">Brother</SelectItem>
                                <SelectItem value="Sister">Sister</SelectItem>
                                <SelectItem value="Husband">Husband</SelectItem>
                                <SelectItem value="Wife">Wife</SelectItem>
                                <SelectItem value="Friend">Friend</SelectItem>
                                <SelectItem value="Other">Other</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                          <div className="space-y-2">
                            <Label htmlFor="emergencyPhone">Phone</Label>
                            <div className="flex gap-2">
                              <Select 
                                value={selectedEmergencyPhoneCountryCode} 
                                onValueChange={(value) => {
                                  setSelectedEmergencyPhoneCountryCode(value);
                                  const phoneWithoutCode = form.watch("emergencyContact.phone")?.startsWith(selectedEmergencyPhoneCountryCode) 
                                    ? form.watch("emergencyContact.phone")?.slice(selectedEmergencyPhoneCountryCode.length).trim() 
                                    : form.watch("emergencyContact.phone") || "";
                                  form.setValue("emergencyContact.phone", phoneWithoutCode ? `${value} ${phoneWithoutCode}` : "");
                                }}
                              >
                                <SelectTrigger className="w-[140px]">
                                  <SelectValue>
                                    <div className="flex items-center gap-2">
                                      <img 
                                        src={`https://flagcdn.com/16x12/${COUNTRY_CODES.find(c => c.code === selectedEmergencyPhoneCountryCode)?.iso}.png`}
                                        alt={COUNTRY_CODES.find(c => c.code === selectedEmergencyPhoneCountryCode)?.name}
                                        className="w-4 h-3"
                                        onError={(e) => e.currentTarget.style.display = 'none'}
                                      />
                                      <span>{selectedEmergencyPhoneCountryCode}</span>
                                    </div>
                                  </SelectValue>
                                </SelectTrigger>
                                <SelectContent>
                                  {COUNTRY_CODES.map((country) => (
                                    <SelectItem key={country.code} value={country.code}>
                                      <div className="flex items-center gap-2">
                                        <img 
                                          src={`https://flagcdn.com/16x12/${country.iso}.png`}
                                          alt={country.name}
                                          className="w-4 h-3"
                                          onError={(e) => e.currentTarget.style.display = 'none'}
                                        />
                                        <span>{country.name}</span>
                                      </div>
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                              <Input
                                id="emergencyPhone"
                                type="tel"
                                className="flex-1"
                                placeholder="123 456 7890"
                                data-testid="input-emergency-phone"
                                maxLength={COUNTRY_DIGIT_LIMITS[selectedEmergencyPhoneCountryCode] || 15}
                                value={
                                  form.watch("emergencyContact.phone")?.startsWith(selectedEmergencyPhoneCountryCode)
                                    ? form.watch("emergencyContact.phone")?.slice(selectedEmergencyPhoneCountryCode.length).trim()
                                    : form.watch("emergencyContact.phone") || ""
                                }
                                onChange={(e) => {
                                  let value = e.target.value.replace(/[^\d]/g, '');
                                  const maxDigits = COUNTRY_DIGIT_LIMITS[selectedEmergencyPhoneCountryCode] || 15;
                                  
                                  // Limit to max digits for selected country
                                  if (value.length > maxDigits) {
                                    value = value.slice(0, maxDigits);
                                  }
                                  
                                  form.setValue("emergencyContact.phone", value ? `${selectedEmergencyPhoneCountryCode} ${value}` : "");
                                }}
                              />
                            </div>
                            <p className="text-xs text-gray-500 mt-1">
                              Must be exactly {COUNTRY_DIGIT_LIMITS[selectedEmergencyPhoneCountryCode]} digits (excluding country code)
                            </p>
                            {form.formState.errors.emergencyContact?.phone && (
                              <p className="text-sm text-red-500">{form.formState.errors.emergencyContact.phone.message}</p>
                            )}
                          </div>
                          <div className="space-y-2">
                            <Label htmlFor="emergencyEmail">Email (Optional)</Label>
                            <Input
                              id="emergencyEmail"
                              type="email"
                              {...form.register("emergencyContact.email")}
                              placeholder="emergency@example.com"
                              data-testid="input-emergency-email"
                            />
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Health Insurance Information */}
                    <div className="p-4 rounded-lg border border-gray-200 dark:border-gray-700">
                      <h5 className="font-medium text-indigo-600 dark:text-indigo-400 mb-4">Health Insurance Information (Optional)</h5>
                      <div className="space-y-4">
                        <div className="grid grid-cols-2 gap-4">
                          <div className="space-y-2">
                            <Label htmlFor="insuranceProvider">Insurance Provider</Label>
                            <Select 
                              onValueChange={(value) => {
                                form.setValue("insuranceInfo.provider", value);
                                setInsuranceProvider(value);
                                // Clear NHS Number error when provider changes
                                setNhsNumberError("");
                              }}
                              value={form.watch("insuranceInfo.provider") || ""}
                            >
                              <SelectTrigger data-testid="dropdown-insurance-provider">
                                <SelectValue placeholder="Select insurance provider..." />
                              </SelectTrigger>
                              <SelectContent>
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
                          </div>
                          <div className="space-y-2">
                            <Label htmlFor="planType">Plan Type</Label>
                            <Popover open={planTypeOpen} onOpenChange={setPlanTypeOpen}>
                              <PopoverTrigger asChild>
                                <Button
                                  variant="outline"
                                  role="combobox"
                                  aria-expanded={planTypeOpen}
                                  className="w-full justify-between"
                                  data-testid="dropdown-plan-type"
                                >
                                  {selectedPlanType || "Select plan type"}
                                  <span className="ml-2 h-4 w-4 shrink-0 opacity-50">▼</span>
                                </Button>
                              </PopoverTrigger>
                              <PopoverContent className="w-full p-0" align="start">
                                <Command>
                                  <CommandInput placeholder="Search plan types..." />
                                  <CommandEmpty>No plan type found.</CommandEmpty>
                                  <CommandGroup>
                                    <CommandList>
                                      {PLAN_TYPES.map((plan) => (
                                        <CommandItem
                                          key={plan.value}
                                          value={plan.value}
                                          onSelect={(currentValue) => {
                                            setSelectedPlanType(currentValue === selectedPlanType ? "" : currentValue);
                                            form.setValue("insuranceInfo.planType", currentValue === selectedPlanType ? "" : currentValue);
                                            setPlanTypeOpen(false);
                                          }}
                                        >
                                          <Check
                                            className={`mr-2 h-4 w-4 ${
                                              selectedPlanType === plan.value ? "opacity-100" : "opacity-0"
                                            }`}
                                          />
                                          {plan.value}
                                        </CommandItem>
                                      ))}
                                    </CommandList>
                                  </CommandGroup>
                                </Command>
                              </PopoverContent>
                            </Popover>
                            {selectedPlanType && (
                              <p className="text-sm text-green-600 dark:text-green-500">
                                {PLAN_TYPES.find((p) => p.value === selectedPlanType)?.description}
                              </p>
                            )}
                          </div>
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                          <div className="space-y-2">
                            <Label htmlFor="policyNumber">Policy Number</Label>
                            <Input
                              id="policyNumber"
                              {...form.register("insuranceInfo.policyNumber")}
                              placeholder="Enter policy number"
                              data-testid="input-policy-number"
                            />
                          </div>
                          <div className="space-y-2">
                            <Label htmlFor="memberNumber">Member Number</Label>
                            <Input
                              id="memberNumber"
                              {...form.register("insuranceInfo.memberNumber")}
                              placeholder="Enter member number"
                              data-testid="input-member-number"
                            />
                          </div>
                        </div>
                        {/* NHS Number and Effective Date in one row */}
                        <div className="grid grid-cols-2 gap-4">
                          {/* NHS Number - Conditional display based on Insurance Provider */}
                          {insuranceProvider && insuranceProvider !== "Self-Pay" && (
                            <div className="space-y-2">
                              <Label htmlFor="nhsNumber">NHS Number</Label>
                              <Input
                                id="nhsNumber"
                                type="tel"
                                maxLength={10}
                                placeholder="9434765919"
                                data-testid="input-nhs-number"
                                value={form.watch("nhsNumber") || ""}
                                onChange={(e) => {
                                  const value = e.target.value.replace(/[^\d]/g, '');
                                  form.setValue("nhsNumber", value);
                                  validateNHSNumber(value);
                                }}
                              />
                              {nhsNumberError && (
                                <p className="text-sm text-red-500">{nhsNumberError}</p>
                              )}
                              <p className="text-xs text-gray-500">Must be exactly 10 digits. Example: 9434765919</p>
                            </div>
                          )}
                          <div className="space-y-2">
                            <Label htmlFor="effectiveDate">Effective Date</Label>
                            <Input
                              id="effectiveDate"
                              type="date"
                              {...form.register("insuranceInfo.effectiveDate")}
                              data-testid="input-effective-date"
                            />
                          </div>
                        </div>
                      </div>
                    </div>
                  </>
                )}

                {/* Department (Optional), Password in one row */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="department">Department (Optional)</Label>
                    <Popover open={departmentOpen} onOpenChange={setDepartmentOpen}>
                      <PopoverTrigger asChild>
                        <Button
                          variant="outline"
                          role="combobox"
                          aria-expanded={departmentOpen}
                          className="w-full justify-between font-normal"
                          data-testid="button-department"
                        >
                          <span className={form.watch("department") ? "text-foreground" : "text-muted-foreground"}>
                            {form.watch("department") || "Select or type department..."}
                          </span>
                          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-full p-0" align="start">
                        <Command>
                          <CommandInput 
                            placeholder="Search or type department..." 
                            onValueChange={(value) => {
                              // Allow typing custom values
                              form.setValue("department", value, { shouldDirty: true });
                            }}
                            data-testid="command-input-department"
                          />
                          <CommandList>
                            <CommandEmpty>
                              <div className="py-2 px-3 text-sm">
                                <p className="text-muted-foreground mb-2">No department found.</p>
                                <p className="text-xs text-muted-foreground">
                                  Press Enter to use: <span className="font-medium">{form.watch("department")}</span>
                                </p>
                              </div>
                            </CommandEmpty>
                            <CommandGroup>
                              <CommandItem
                                value=""
                                onSelect={() => {
                                  form.setValue("department", "", { shouldDirty: true });
                                  setDepartmentOpen(false);
                                }}
                                data-testid="command-item-department-none"
                              >
                                <Check
                                  className={`mr-2 h-4 w-4 ${!form.watch("department") ? "opacity-100" : "opacity-0"}`}
                                />
                                (None)
                              </CommandItem>
                              {DEPARTMENTS.map((dept) => (
                                <CommandItem
                                  key={dept}
                                  value={dept}
                                  onSelect={(currentValue) => {
                                    form.setValue("department", currentValue, { shouldDirty: true });
                                    setDepartmentOpen(false);
                                  }}
                                  data-testid={`command-item-department-${dept.toLowerCase().replace(/\s+/g, '-')}`}
                                >
                                  <Check
                                    className={`mr-2 h-4 w-4 ${form.watch("department") === dept ? "opacity-100" : "opacity-0"}`}
                                  />
                                  {dept}
                                </CommandItem>
                              ))}
                            </CommandGroup>
                          </CommandList>
                        </Command>
                      </PopoverContent>
                    </Popover>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="password">
                      {editingUser ? "New Password *" : "Password"}
                    </Label>
                    <div className="relative">
                      <Input
                        id="password"
                        type={showPassword ? "text" : "password"}
                        {...form.register("password")}
                        className={form.formState.errors.password ? "border-red-500 pr-10" : "pr-10"}
                        data-testid="input-password"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
                        data-testid="button-toggle-password-visibility"
                      >
                        {showPassword ? (
                          <EyeOff className="h-4 w-4" />
                        ) : (
                          <Eye className="h-4 w-4" />
                        )}
                      </button>
                    </div>
                    {form.formState.errors.password && (
                      <p className="text-sm text-red-500">{form.formState.errors.password.message}</p>
                    )}
                  </div>
                </div>

                {/* Role Information */}
                <div className="bg-blue-50 p-4 rounded-lg">
                  <h4 className="font-medium text-blue-900 mb-2">
                    {getRoleDisplayName(selectedRole)} Access Level:
                  </h4>
                  <p className="text-sm text-blue-700">
                    {selectedRole === 'admin' && "Full system access including user management, settings, and all clinical modules."}
                    {isDoctorLike(selectedRole) && "Clinical access to patient records, appointments, prescriptions, and medical documentation."}
                    {selectedRole === 'nurse' && "Patient care access including medical records, medications, and care coordination."}
                    {selectedRole === 'receptionist' && "Limited access to patient information, appointments, and billing functions."}
                    {selectedRole === 'patient' && "Personal health record access including appointments, prescriptions, and medical history."}
                    {selectedRole === 'sample_taker' && "Lab-focused access for sample collection, lab results, and basic patient information."}
                    {selectedRole === 'lab_technician' && "Lab-focused access for sample collection, lab results, and basic patient information."}
                  </p>
                  <p className="text-xs text-blue-600 mt-2">
                    ✓ Permissions will be automatically assigned based on the selected role
                  </p>
                </div>
                
                <DialogFooter>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => {
                      setIsCreateModalOpen(false);
                      setEditingUser(null);
                      setSelectedRole("doctor");
                      form.reset();
                      setEmailValidationStatus('idle');
                      if (emailCheckTimeout) {
                        clearTimeout(emailCheckTimeout);
                      }
                      // Reset Plan Type state
                      setSelectedPlanType("");
                      setPlanTypeOpen(false);
                    }}
                  >
                    Cancel
                  </Button>
                  <Button 
                    type="submit" 
                    disabled={
                      createUserMutation.isPending || 
                      updateUserMutation.isPending || 
                      emailValidationStatus === 'exists' ||
                      emailValidationStatus === 'checking' ||
                      (!editingUser && subscriptionLimitData && (
                        selectedRole === 'patient' 
                          ? subscriptionLimitData.remainingPatients <= 0 
                          : subscriptionLimitData.remainingUsers <= 0
                      ))
                    }
                    onClick={() => {
                      console.log("🔍 Button Clicked");
                      console.log("  Form errors:", form.formState.errors);
                      console.log("  Form isValid:", form.formState.isValid);
                      console.log("  Form isSubmitting:", form.formState.isSubmitting);
                      console.log("  emailValidationStatus:", emailValidationStatus);
                    }}
                  >
                    {createUserMutation.isPending || updateUserMutation.isPending ? 
                      "Saving..." : 
                      (editingUser ? "Update User" : "Create User")
                    }
                  </Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>

        {/* Users List */}
        <Card>
          <CardHeader>
            <CardTitle>System Users</CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="text-center py-8 text-gray-600 dark:text-gray-300">Loading users...</div>
            ) : filteredUsers.length === 0 ? (
              <div className="text-center py-8 text-gray-500 dark:text-gray-400">
                {searchTerm || roleFilter !== "all" ? "No users found matching your filters." : "No users found."}
              </div>
            ) : userViewType === "list" ? (
              <div className="space-y-6">
                {Object.entries(groupedUsers).map(([role, roleUsers]) => (
                  <div key={role} className="space-y-3">
                    <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 border-b pb-2">
                      {roleDisplayNames[role] || role} ({roleUsers.length})
                    </h3>
                    <div className="space-y-3">
                      {roleUsers.map((user) => (
                        <div
                          key={`user-${user.id}-${user.email}`}
                          className="flex items-center justify-between p-4 border border-gray-200 dark:border-gray-700 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 bg-white dark:bg-gray-900"
                          data-testid={`user-card-${user.id}`}
                        >
                          <div className="flex items-center space-x-4">
                            <div className="w-10 h-10 bg-blue-100 dark:bg-blue-900 rounded-full flex items-center justify-center">
                              {getRoleIcon(user.role)}
                            </div>
                            <div>
                              <h3 className="font-medium text-gray-900 dark:text-gray-100">
                                {user.firstName || 'N/A'} {user.lastName || 'N/A'}
                              </h3>
                              <p className="text-sm text-gray-500 dark:text-gray-400">{user.email}</p>
                              {user.department && user.department.trim() && (
                                <p className="text-xs text-gray-400 dark:text-gray-500">{user.department}</p>
                              )}
                              {user.workingDays && user.workingDays.length > 0 && (
                                <p className="text-xs text-blue-600 dark:text-blue-400">
                                  Working: {user.workingDays.join(", ")} ({user.workingHours?.start || '09:00'} - {user.workingHours?.end || '17:00'})
                                </p>
                              )}
                              
                              {/* Medical Specialty Tags for Doctor-like roles */}
                              {isDoctorLike(user.role) && (user.subSpecialty || user.medicalSpecialtyCategory) && (
                                <div className="flex gap-1 mt-2">
                                  {user.subSpecialty && (
                                    <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-800 border">
                                      {user.subSpecialty}
                                    </span>
                                  )}
                                  {user.medicalSpecialtyCategory && (
                                    <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-800 border">
                                      {user.medicalSpecialtyCategory}
                                    </span>
                                  )}
                                </div>
                              )}
                            </div>
                          </div>
                          
                          <div className="flex items-center space-x-3">
                            <Badge className={getRoleColor(user.role)}>
                              {getRoleDisplayName(user.role)}
                            </Badge>
                            
                            <Badge variant={user.isActive ? "default" : "secondary"}>
                              {user.isActive ? "Active" : "Inactive"}
                            </Badge>
                            
                            <div className="flex items-center space-x-2">
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => handleEdit(user)}
                                title="Edit User"
                                data-testid={`button-edit-user-${user.id}`}
                                className="flex items-center gap-1"
                              >
                                <Edit className="h-4 w-4" />
                                <span>Edit User</span>
                              </Button>
                              
                              <AlertDialog>
                                <AlertDialogTrigger asChild>
                                  <Button variant="ghost" size="sm" className="text-red-600 hover:text-red-700" data-testid={`button-delete-user-${user.id}`}>
                                    <Trash2 className="h-4 w-4" />
                                  </Button>
                                </AlertDialogTrigger>
                                <AlertDialogContent>
                                  <AlertDialogHeader>
                                    <AlertDialogTitle>Delete User</AlertDialogTitle>
                                    <AlertDialogDescription asChild>
                                      <div className="space-y-3">
                                        <p className="text-base font-medium text-gray-900 dark:text-gray-100">
                                          Do you want to delete {user.firstName} {user.lastName} ({getRoleDisplayName(user.role)})?
                                        </p>
                                        <div className="bg-gray-50 dark:bg-gray-800 p-4 rounded-lg space-y-2 text-sm">
                                          <div className="flex justify-between">
                                            <span className="font-medium text-gray-700 dark:text-gray-300">Name:</span>
                                            <span className="text-gray-900 dark:text-gray-100">{user.firstName} {user.lastName}</span>
                                          </div>
                                          <div className="flex justify-between">
                                            <span className="font-medium text-gray-700 dark:text-gray-300">Role:</span>
                                            <span className="text-gray-900 dark:text-gray-100">{getRoleDisplayName(user.role)}</span>
                                          </div>
                                          <div className="flex justify-between">
                                            <span className="font-medium text-gray-700 dark:text-gray-300">Email:</span>
                                            <span className="text-gray-900 dark:text-gray-100">{user.email}</span>
                                          </div>
                                          {user.department && (
                                            <div className="flex justify-between">
                                              <span className="font-medium text-gray-700 dark:text-gray-300">Department:</span>
                                              <span className="text-gray-900 dark:text-gray-100">{user.department}</span>
                                            </div>
                                          )}
                                          <div className="flex justify-between">
                                            <span className="font-medium text-gray-700 dark:text-gray-300">Status:</span>
                                            <span className="text-gray-900 dark:text-gray-100">{user.isActive ? "Active" : "Inactive"}</span>
                                          </div>
                                        </div>
                                        <div className="bg-yellow-50 dark:bg-yellow-900/20 p-4 rounded-lg">
                                          <p className="font-medium text-sm text-yellow-800 dark:text-yellow-200 mb-2">The following data will be deleted:</p>
                                          <ul className="text-xs text-yellow-700 dark:text-yellow-300 space-y-1 ml-4 list-disc">
                                            <li>Delete notifications for user</li>
                                            <li>Delete prescriptions where user is the doctor (doctorId)</li>
                                            <li>Delete appointments where user is provider</li>
                                            <li>Delete lab results ordered by user (orderedBy)</li>
                                            <li>Delete default shifts for user</li>
                                            <li>Delete custom shifts for user</li>
                                            <li>Find patient record linked to this user</li>
                                            <li>Delete prescriptions FOR this patient (patientId)</li>
                                            <li>Delete lab results for this patient (patientId)</li>
                                            <li>Delete medical images for this patient (patientId)</li>
                                            <li>Delete symptom checks for this patient (patientId)</li>
                                            <li>Delete patient record</li>
                                            <li>Delete user</li>
                                          </ul>
                                        </div>
                                        <p className="text-sm text-red-600 dark:text-red-400">
                                          This action cannot be undone and will remove all their access to the system.
                                        </p>
                                      </div>
                                    </AlertDialogDescription>
                                  </AlertDialogHeader>
                                  <AlertDialogFooter>
                                    <AlertDialogCancel>No, Cancel</AlertDialogCancel>
                                    <AlertDialogAction
                                      onClick={() => handleDelete(user.id)}
                                      className="bg-red-600 hover:bg-red-700"
                                    >
                                      Yes, Delete
                                    </AlertDialogAction>
                                  </AlertDialogFooter>
                                </AlertDialogContent>
                              </AlertDialog>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {filteredUsers.map((user) => (
                  <Card key={`user-grid-${user.id}-${user.email}`} className="hover:shadow-lg transition-shadow" data-testid={`user-grid-card-${user.id}`}>
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between mb-3">
                        <div className="flex items-center space-x-3">
                          <div className="w-12 h-12 bg-blue-100 dark:bg-blue-900 rounded-full flex items-center justify-center">
                            {getRoleIcon(user.role)}
                          </div>
                          <div>
                            <h3 className="font-medium text-gray-900 dark:text-gray-100">
                              {user.firstName || 'N/A'} {user.lastName || 'N/A'}
                            </h3>
                            <Badge className={getRoleColor(user.role)}>
                              {getRoleDisplayName(user.role)}
                            </Badge>
                          </div>
                        </div>
                        <Badge variant={user.isActive ? "default" : "secondary"}>
                          {user.isActive ? "Active" : "Inactive"}
                        </Badge>
                      </div>
                      
                      <p className="text-sm text-gray-500 dark:text-gray-400 mb-2">{user.email}</p>
                      
                      {user.department && user.department.trim() && (
                        <p className="text-xs text-gray-400 dark:text-gray-500 mb-2">{user.department}</p>
                      )}
                      
                      {user.workingDays && user.workingDays.length > 0 && (
                        <p className="text-xs text-blue-600 dark:text-blue-400 mb-2">
                          {user.workingDays.join(", ")} • {user.workingHours?.start || '09:00'} - {user.workingHours?.end || '17:00'}
                        </p>
                      )}
                      
                      {isDoctorLike(user.role) && (user.subSpecialty || user.medicalSpecialtyCategory) && (
                        <div className="flex gap-1 mb-3 flex-wrap">
                          {user.subSpecialty && (
                            <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-800 border">
                              {user.subSpecialty}
                            </span>
                          )}
                          {user.medicalSpecialtyCategory && (
                            <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-800 border">
                              {user.medicalSpecialtyCategory}
                            </span>
                          )}
                        </div>
                      )}
                      
                      <div className="flex items-center justify-end space-x-2 pt-3 border-t">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleEdit(user)}
                          title="Edit User"
                          data-testid={`button-edit-user-grid-${user.id}`}
                          className="flex items-center gap-1"
                        >
                          <Edit className="h-4 w-4" />
                          <span>Edit User</span>
                        </Button>
                        
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button variant="ghost" size="sm" className="text-red-600 hover:text-red-700" data-testid={`button-delete-user-grid-${user.id}`}>
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Delete User</AlertDialogTitle>
                              <AlertDialogDescription asChild>
                                <div className="space-y-3">
                                  <p className="text-base font-medium text-gray-900 dark:text-gray-100">
                                    Do you want to delete {user.firstName} {user.lastName} ({getRoleDisplayName(user.role)})?
                                  </p>
                                  <div className="bg-gray-50 dark:bg-gray-800 p-4 rounded-lg space-y-2 text-sm">
                                    <div className="flex justify-between">
                                      <span className="font-medium text-gray-700 dark:text-gray-300">Name:</span>
                                      <span className="text-gray-900 dark:text-gray-100">{user.firstName} {user.lastName}</span>
                                    </div>
                                    <div className="flex justify-between">
                                      <span className="font-medium text-gray-700 dark:text-gray-300">Role:</span>
                                      <span className="text-gray-900 dark:text-gray-100">{getRoleDisplayName(user.role)}</span>
                                    </div>
                                    <div className="flex justify-between">
                                      <span className="font-medium text-gray-700 dark:text-gray-300">Email:</span>
                                      <span className="text-gray-900 dark:text-gray-100">{user.email}</span>
                                    </div>
                                    {user.department && (
                                      <div className="flex justify-between">
                                        <span className="font-medium text-gray-700 dark:text-gray-300">Department:</span>
                                        <span className="text-gray-900 dark:text-gray-100">{user.department}</span>
                                      </div>
                                    )}
                                    <div className="flex justify-between">
                                      <span className="font-medium text-gray-700 dark:text-gray-300">Status:</span>
                                      <span className="text-gray-900 dark:text-gray-100">{user.isActive ? "Active" : "Inactive"}</span>
                                    </div>
                                  </div>
                                  <div className="bg-yellow-50 dark:bg-yellow-900/20 p-4 rounded-lg">
                                    <p className="font-medium text-sm text-yellow-800 dark:text-yellow-200 mb-2">The following data will be deleted:</p>
                                    <ul className="text-xs text-yellow-700 dark:text-yellow-300 space-y-1 ml-4 list-disc">
                                      <li>Delete notifications for user</li>
                                      <li>Delete prescriptions where user is the doctor (doctorId)</li>
                                      <li>Delete appointments where user is provider</li>
                                      <li>Delete lab results ordered by user (orderedBy)</li>
                                      <li>Delete default shifts for user</li>
                                      <li>Delete custom shifts for user</li>
                                      <li>Find patient record linked to this user</li>
                                      <li>Delete prescriptions FOR this patient (patientId)</li>
                                      <li>Delete lab results for this patient (patientId)</li>
                                      <li>Delete medical images for this patient (patientId)</li>
                                      <li>Delete symptom checks for this patient (patientId)</li>
                                      <li>Delete patient record</li>
                                      <li>Delete user</li>
                                    </ul>
                                  </div>
                                  <p className="text-sm text-red-600 dark:text-red-400">
                                    This action cannot be undone and will remove all their access to the system.
                                  </p>
                                </div>
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>No, Cancel</AlertDialogCancel>
                              <AlertDialogAction
                                onClick={() => handleDelete(user.id)}
                                className="bg-red-600 hover:bg-red-700"
                              >
                                Yes, Delete
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
          </>
        )}

        {activeTab === "roles" && (
          <>
            {/* Role Management Header and Controls */}
            <div className="flex items-center justify-between mb-6">
              <div className="flex-1">
                <h2 className="text-lg font-semibold text-gray-900">Role Management</h2>
                <p className="text-sm text-gray-600">Create and manage custom roles with specific permissions</p>
              </div>
              
              <div className="flex gap-2">
                {/* View Toggle for Roles */}
                <div className="flex border rounded-lg overflow-hidden">
                  <Button
                    variant={roleViewType === "list" ? "default" : "ghost"}
                    size="sm"
                    onClick={() => setRoleViewType("list")}
                    className="rounded-none"
                    data-testid="button-role-list-view"
                  >
                    <LayoutList className="h-4 w-4" />
                  </Button>
                  <Button
                    variant={roleViewType === "grid" ? "default" : "ghost"}
                    size="sm"
                    onClick={() => setRoleViewType("grid")}
                    className="rounded-none"
                    data-testid="button-role-grid-view"
                  >
                    <LayoutGrid className="h-4 w-4" />
                  </Button>
                </div>
              
                <Dialog open={isRoleModalOpen || !!editingRole} onOpenChange={(open) => {
                  if (!open) {
                    setIsRoleModalOpen(false);
                    setEditingRole(null);
                    roleForm.reset({
                      name: "",
                      displayName: "",
                      description: "",
                      permissions: getInitialPermissions(),
                    });
                    setRoleNameError("");
                    setRoleDisplayNameError("");
                  }
                }}>
                <DialogTrigger asChild>
                  <Button onClick={openRoleModalForCreate} className="flex items-center gap-2">
                      <Plus className="h-4 w-4" />
                      Create New Role
                    </Button>
                  </DialogTrigger>
                <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
                  <DialogHeader>
                    <DialogTitle>
                      {editingRole ? "Edit Role" : "Create New Role"}
                    </DialogTitle>
                    <DialogDescription>
                      {editingRole 
                        ? "Update the role's information and permissions."
                        : "Create a new role with specific permissions and access levels."
                      }
                    </DialogDescription>
                  </DialogHeader>
                  
                  <form onSubmit={roleForm.handleSubmit(onRoleSubmit)} className="space-y-6">
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="roleName">Role Name</Label>
                        <Input
                          id="roleName"
                          value={roleForm.watch("name") || ""}
                          onChange={(e) => {
                            const lowercaseValue = e.target.value.toLowerCase();
                            roleForm.setValue("name", lowercaseValue, { shouldValidate: true });
                            
                            // Check for duplicate role name (only when creating, not editing)
                            if (!editingRole && lowercaseValue) {
                              const existingRole = roles.find((role: Role) => 
                                role.name.toLowerCase() === lowercaseValue
                              );
                              if (existingRole) {
                                setRoleNameError("Role already exist. Please select another Role");
                              } else {
                                setRoleNameError("");
                              }
                            } else {
                              setRoleNameError("");
                            }
                          }}
                          placeholder="e.g., senior_doctor"
                          className={roleForm.formState.errors.name || roleNameError ? "border-red-500" : ""}
                        />
                        {roleForm.formState.errors.name && (
                          <p className="text-sm text-red-500">{roleForm.formState.errors.name.message}</p>
                        )}
                        {roleNameError && !roleForm.formState.errors.name && (
                          <p className="text-sm text-red-500">{roleNameError}</p>
                        )}
                      </div>
                      
                      <div className="space-y-2">
                        <Label htmlFor="roleDisplayName">Display Name</Label>
                        <Input
                          id="roleDisplayName"
                          value={roleForm.watch("displayName") || ""}
                          onChange={(e) => {
                            const value = e.target.value;
                            roleForm.setValue("displayName", value, { shouldValidate: true });
                            
                            // Check for duplicate display name (only when creating, not editing)
                            if (!editingRole && value) {
                              const existingRole = roles.find((role: Role) => 
                                role.displayName.toLowerCase() === value.toLowerCase()
                              );
                              if (existingRole) {
                                setRoleDisplayNameError("Role already exist. Please select another Role");
                              } else {
                                setRoleDisplayNameError("");
                              }
                            } else {
                              setRoleDisplayNameError("");
                            }
                          }}
                          placeholder="e.g., Senior Doctor"
                          className={roleForm.formState.errors.displayName || roleDisplayNameError ? "border-red-500" : ""}
                        />
                        {roleForm.formState.errors.displayName && (
                          <p className="text-sm text-red-500">{roleForm.formState.errors.displayName.message}</p>
                        )}
                        {roleDisplayNameError && !roleForm.formState.errors.displayName && (
                          <p className="text-sm text-red-500">{roleDisplayNameError}</p>
                        )}
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="roleDescription">Description</Label>
                      <Input
                        id="roleDescription"
                        {...roleForm.register("description")}
                        placeholder="Describe the role's responsibilities and access level"
                        className={roleForm.formState.errors.description ? "border-red-500" : ""}
                      />
                      {roleForm.formState.errors.description && (
                        <p className="text-sm text-red-500">{roleForm.formState.errors.description.message}</p>
                      )}
                    </div>

                    <div className="space-y-4">
                      <Label>Module Permissions</Label>
                      <div className="bg-gray-50 dark:bg-gray-800 p-4 rounded-lg border dark:border-gray-700 max-h-[400px] overflow-y-auto">
                        <p className="text-sm text-gray-600 dark:text-gray-300 mb-4">
                          Configure what modules this role can access and what actions they can perform.
                        </p>
                        
                        <div className="space-y-4">
                          {/* Permission Matrix Headers */}
                          <div className="grid grid-cols-5 gap-2 text-sm font-medium text-gray-700 dark:text-gray-300 pb-2 border-b border-gray-200 dark:border-gray-600">
                            <div>Module</div>
                            {MODULE_ACTIONS.map((action) => {
                              const isChecked = isActionFullyEnabled(modulePermissionValues, action);
                              const label = action.charAt(0).toUpperCase() + action.slice(1);
                              return (
                                <div key={action} className="text-center">
                                  <label className="inline-flex flex-col items-center text-xs uppercase tracking-wide cursor-pointer select-none">
                                    <span className="font-semibold">{label}</span>
                                    <input
                                      type="checkbox"
                                      checked={isChecked}
                                      onChange={(e) => toggleActionForAllModules(roleForm, action, e.target.checked)}
                                      className="mt-1 w-4 h-4 text-blue-600 bg-gray-100 border-gray-300 rounded focus:ring-blue-500 focus:ring-2"
                                    />
                                  </label>
                                </div>
                              );
                            })}
                          </div>

                          {/* Module Permissions */}
                          {MODULE_PERMISSIONS_LIST.map((module) => {
                            const currentPerms = (roleForm.watch(`permissions.modules.${module.key}`) as ModulePermission | undefined) ?? createEmptyModulePermission();
                            
                            return (
                              <div key={module.key} className="grid grid-cols-5 gap-2 items-center py-2 border-b border-gray-100 dark:border-gray-700 last:border-b-0">
                                <div>
                                  <div className="font-medium text-gray-900 dark:text-gray-100">{module.name}</div>
                                  <div className="text-xs text-gray-500 dark:text-gray-400">{module.description}</div>
                                </div>
                                
                                {MODULE_ACTIONS.map((action) => (
                                  <div key={action} className="flex justify-center">
                                    <input
                                      type="checkbox"
                                      checked={currentPerms[action] === true}
                                      onChange={(e) => {
                                        // Get current form state to ensure we have clean data
                                        const allPerms = roleForm.getValues('permissions.modules') || {};
                                        const currentModule = allPerms[module.key] || createEmptyModulePermission();
                                        
                                        // Create updated module permission object with all required boolean fields
                                        const updatedModule = {
                                          view: typeof currentModule.view === 'boolean' ? currentModule.view : false,
                                          create: typeof currentModule.create === 'boolean' ? currentModule.create : false,
                                          edit: typeof currentModule.edit === 'boolean' ? currentModule.edit : false,
                                          delete: typeof currentModule.delete === 'boolean' ? currentModule.delete : false,
                                          [action]: e.target.checked
                                        };
                                        
                                        roleForm.setValue(`permissions.modules.${module.key}`, updatedModule, { 
                                          shouldValidate: false,
                                          shouldDirty: true,
                                        });
                                      }}
                                      className="w-4 h-4 text-blue-600 bg-gray-100 border-gray-300 rounded focus:ring-blue-500 dark:focus:ring-blue-600 dark:ring-offset-gray-800 focus:ring-2 dark:bg-gray-700 dark:border-gray-600"
                                    />
                                  </div>
                                ))}
                              </div>
                            );
                          })}
                        </div>

{/* Sensitive Field Access - Hidden until field-level permission enforcement is implemented */}
                      </div>
                    </div>
                    
                    <DialogFooter>
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => {
                          setIsRoleModalOpen(false);
                          setEditingRole(null);
                          roleForm.reset();
                        }}
                      >
                        Cancel
                      </Button>
                      <Button
                        type="submit"
                        disabled={createRoleMutation.isPending || updateRoleMutation.isPending}
                      >
                        {createRoleMutation.isPending || updateRoleMutation.isPending
                          ? "Saving..."
                          : "Save Role"}
                      </Button>
                    </DialogFooter>
                  </form>
                </DialogContent>
              </Dialog>
              </div>
            </div>

            {/* Roles List */}
            <Card>
              <CardHeader>
                <CardTitle>System Roles</CardTitle>
              </CardHeader>
              <CardContent>
                {rolesLoading ? (
                  <div className="text-center py-8">Loading roles...</div>
                ) : roles.length === 0 ? (
                  <div className="text-center py-8 text-gray-500">
                    No roles found. Create your first custom role to get started.
                  </div>
                ) : roleViewType === "list" ? (
                  <div className="space-y-4">
                    {roles.map((role: Role) => (
                      <div
                        key={role.id}
                        className="flex items-center justify-between p-4 border rounded-lg hover:bg-gray-50"
                        data-testid={`role-card-${role.id}`}
                      >
                        <div className="flex items-center space-x-4">
                          <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center">
                            <Shield className="h-5 w-5 text-blue-600" />
                          </div>
                          <div>
                            <h3 className="font-medium text-white bg-orange-500 px-3 py-1 rounded w-40 text-center text-sm">
                              {role.displayName}
                            </h3>
                            <p className="text-xs text-gray-500">{role.description}</p>
                            <p className="text-[10px] text-gray-400">Role ID: {role.name}</p>
                          </div>
                        </div>

                        
                        <div className="flex items-center space-x-3">
                          <Badge variant={role.isSystem ? "secondary" : "default"}>
                            {role.isSystem ? "System Role" : "Custom Role"}
                          </Badge>
                          
                          <div className="flex items-center space-x-2">
                            {/* Edit button available for all roles */}
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleEditRole(role)}
                              className="text-blue-600 hover:text-blue-700"
                              data-testid={`button-edit-role-${role.id}`}
                            >
                              <Edit className="h-4 w-4" />
                            </Button>
                            
                            {role.isSystem === false && canManageRoles && (
                              <AlertDialog>
                                <AlertDialogTrigger asChild>
                                  <Button variant="ghost" size="sm" className="text-red-600 hover:text-red-700" data-testid={`button-delete-role-${role.id}`}>
                                    <Trash2 className="h-4 w-4" />
                                  </Button>
                                </AlertDialogTrigger>
                                <AlertDialogContent>
                                  <AlertDialogHeader>
                                    <AlertDialogTitle>Delete Role</AlertDialogTitle>
                                    <AlertDialogDescription>
                                      Are you sure you want to delete the "{role.displayName}" role? 
                                      This action cannot be undone and will affect all users with this role.
                                    </AlertDialogDescription>
                                  </AlertDialogHeader>
                                  <AlertDialogFooter>
                                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                                    <AlertDialogAction
                                      onClick={() => handleDeleteRole(role.id)}
                                      className="bg-red-600 hover:bg-red-700"
                                    >
                                      Delete Role
                                    </AlertDialogAction>
                                  </AlertDialogFooter>
                                </AlertDialogContent>
                              </AlertDialog>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {roles.map((role: Role) => (
                      <Card key={`role-grid-${role.id}`} className="hover:shadow-lg transition-shadow" data-testid={`role-grid-card-${role.id}`}>
                        <CardContent className="p-4">
                          <div className="flex items-start justify-between mb-3">
                            <div className="flex items-center space-x-3">
                              <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center">
                                <Shield className="h-6 w-6 text-blue-600" />
                              </div>
                              <div>
                                <h3 className="font-medium text-gray-900">
                                  {role.displayName}
                                </h3>
                                <Badge variant={role.isSystem ? "secondary" : "default"}>
                                  {role.isSystem ? "System" : "Custom"}
                                </Badge>
                              </div>
                            </div>
                          </div>
                          
                          <p className="text-sm text-gray-500 mb-2">{role.description}</p>
                          <p className="text-xs text-gray-400 mb-3">Role ID: {role.name}</p>
                          
                          <div className="flex items-center justify-end space-x-2 pt-3 border-t">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleEditRole(role)}
                              className="text-blue-600 hover:text-blue-700"
                              data-testid={`button-edit-role-grid-${role.id}`}
                            >
                              <Edit className="h-4 w-4" />
                            </Button>
                            
                            {role.isSystem === false && canManageRoles && (
                              <AlertDialog>
                                <AlertDialogTrigger asChild>
                                  <Button variant="ghost" size="sm" className="text-red-600 hover:text-red-700" data-testid={`button-delete-role-grid-${role.id}`}>
                                    <Trash2 className="h-4 w-4" />
                                  </Button>
                                </AlertDialogTrigger>
                                <AlertDialogContent>
                                  <AlertDialogHeader>
                                    <AlertDialogTitle>Delete Role</AlertDialogTitle>
                                    <AlertDialogDescription>
                                      Are you sure you want to delete the "{role.displayName}" role? 
                                      This action cannot be undone and will affect all users with this role.
                                    </AlertDialogDescription>
                                  </AlertDialogHeader>
                                  <AlertDialogFooter>
                                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                                    <AlertDialogAction
                                      onClick={() => handleDeleteRole(role.id)}
                                      className="bg-red-600 hover:bg-red-700"
                                    >
                                      Delete Role
                                    </AlertDialogAction>
                                  </AlertDialogFooter>
                                </AlertDialogContent>
                              </AlertDialog>
                            )}
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </>
        )}
      </div>

      {/* Success Modal */}
      <Dialog open={showSuccessModal} onOpenChange={setShowSuccessModal}>
        <DialogContent className="max-w-lg">
          <div className="p-6">
            {/* Success Icon */}
            <div className="flex justify-center mb-6">
              <div className="bg-green-500 rounded-full p-3">
                <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                </svg>
              </div>
            </div>

            {/* Title */}
            <DialogHeader className="text-center mb-6">
              <DialogTitle className="text-xl font-semibold text-gray-900 dark:text-gray-100">
                {successTitle}
              </DialogTitle>
              {successTitle === "User Created Successfully" && (
                <p className="text-sm text-gray-600 dark:text-gray-400 mt-2">
                  The user has been created successfully and saved.
                </p>
              )}
              {successTitle === "User Updated Successfully" && successMessage && (
                <p className="text-sm text-gray-600 dark:text-gray-400 mt-2">
                  {successMessage}
                </p>
              )}
              {successTitle === "User Deleted Successfully" && (
                <p className="text-sm text-gray-600 dark:text-gray-400 mt-2">
                  All related data has been permanently removed from the system
                </p>
              )}
            </DialogHeader>
            
            {/* Deletion Steps - Only show for deletions */}
            {successMessage && successTitle === "User Deleted Successfully" && (
              <div className="bg-gray-50 dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4 mb-6">
              <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">
                Completed Operations
              </h4>
              <div className="space-y-2 max-h-60 overflow-y-auto">
                {successMessage.split('\n').slice(2).map((step, index) => {
                  if (!step.trim()) return null;
                  return (
                    <div key={index} className="flex items-start gap-2">
                      <div className="flex-shrink-0 mt-0.5">
                        <svg className="w-4 h-4 text-green-500" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                        </svg>
                      </div>
                      <p className="flex-1 text-gray-700 dark:text-gray-300 text-sm">
                        {step.trim().substring(step.trim().indexOf('.') + 1).trim()}
                      </p>
                    </div>
                  );
                })}
              </div>
            </div>
            )}

            {/* Action Button */}
            <div className="flex justify-center">
              <Button
                onClick={() => {
                  setShowSuccessModal(false);
                  setSuccessMessage("");
                  setSuccessTitle("");
                }}
                className="w-full bg-[#4A7DFF] hover:bg-[#3A6DEF] text-white"
                data-testid="button-success-ok"
              >
                Close
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}