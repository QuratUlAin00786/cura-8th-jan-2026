import { MailService } from '@sendgrid/mail';

const mailService = new MailService();
if (process.env.SENDGRID_API_KEY) {
  mailService.setApiKey(process.env.SENDGRID_API_KEY);
}

interface EmailParams {
  to: string;
  from: string;
  subject: string;
  text?: string;
  html?: string;
  attachments?: Array<{
    content: string;
    filename: string;
    type: string;
    disposition: string;
  }>;
}

interface ClinicHeaderData {
  logoBase64?: string | null;
  logoPosition: string;
  clinicName: string;
  address?: string | null;
  phone?: string | null;
  email?: string | null;
  website?: string | null;
  clinicNameFontSize?: string;
  fontSize?: string;
  fontFamily?: string;
  fontWeight?: string;
  fontStyle?: string;
  textDecoration?: string;
}

interface ClinicFooterData {
  footerText: string;
  backgroundColor: string;
  textColor: string;
  showSocial: boolean;
  facebook?: string | null;
  twitter?: string | null;
  linkedin?: string | null;
}

export interface SendEmailResult {
  success: boolean;
  error?: string;
}

const formatSendGridError = (error: any): string => {
  if (error?.response?.body?.errors) {
    const errors = error.response.body.errors;
    if (Array.isArray(errors) && errors.length > 0) {
      return errors
        .map(
          (err: any) =>
            err?.message ?? (err?.detail ? `${err.detail}` : "Unknown SendGrid error"),
        )
        .join(" | ");
    }
  }
  if (error?.message) {
    return error.message;
  }
  return "Unknown SendGrid error";
};

export async function sendEmailDetailed(params: EmailParams): Promise<SendEmailResult> {
  if (!process.env.SENDGRID_API_KEY) {
    const message = "SENDGRID_API_KEY environment variable is not set";
    console.error('SendGrid email error:', message);
    return { success: false, error: message };
  }
  
  try {
    await mailService.send({
      to: params.to,
      from: params.from,
      subject: params.subject,
      text: params.text,
      html: params.html,
      attachments: params.attachments,
    });
    return { success: true };
  } catch (error: any) {
    const errorMessage = formatSendGridError(error);
    console.error('SendGrid email error:', errorMessage, error);
    return { success: false, error: errorMessage };
  }
}

export async function sendEmail(params: EmailParams): Promise<boolean> {
  const result = await sendEmailDetailed(params);
  return result.success;
}

export function generatePrescriptionEmailHTML(
  patientName: string,
  clinicHeader?: ClinicHeaderData,
  clinicFooter?: ClinicFooterData
): string {
  // Default values if no clinic header provided
  const headerData = clinicHeader || {
    logoPosition: 'center',
    clinicName: 'Cura EMR',
    clinicNameFontSize: '24pt',
    fontSize: '12pt',
    fontFamily: 'verdana',
    fontWeight: 'normal',
    fontStyle: 'normal',
    textDecoration: 'none'
  };

  // Default footer if not provided
  const footerData = clinicFooter || {
    footerText: 'Cura EMR Platform',
    backgroundColor: '#4A7DFF',
    textColor: '#FFFFFF',
    showSocial: false
  };

  // Logo HTML based on position
  let logoHTML = '';
  if (headerData.logoBase64) {
    const logoSrc = headerData.logoBase64.startsWith('data:') 
      ? headerData.logoBase64 
      : `data:image/png;base64,${headerData.logoBase64}`;
    
    logoHTML = `<img src="${logoSrc}" alt="Clinic Logo" style="max-width: 120px; max-height: 80px; margin-bottom: 10px;" />`;
  }

  // Header layout based on position
  let headerHTML = '';
  const textAlign = headerData.logoPosition === 'left' ? 'left' : headerData.logoPosition === 'right' ? 'right' : 'center';
  
  const clinicInfoHTML = `
    <div style="text-align: ${textAlign}; font-family: ${headerData.fontFamily || 'verdana'};">
      ${logoHTML}
      <div style="
        font-size: ${headerData.clinicNameFontSize || '24pt'}; 
        font-weight: ${headerData.fontWeight || 'normal'};
        font-style: ${headerData.fontStyle || 'normal'};
        text-decoration: ${headerData.textDecoration || 'none'};
        color: #4CAF50;
        margin-bottom: 8px;
      ">${headerData.clinicName}</div>
      ${headerData.address ? `<div style="font-size: ${headerData.fontSize || '12pt'}; color: #666;">${headerData.address}</div>` : ''}
      <div style="font-size: ${headerData.fontSize || '12pt'}; color: #666;">
        ${headerData.phone ? `${headerData.phone}` : ''}${headerData.phone && headerData.email ? ' • ' : ''}${headerData.email ? headerData.email : ''}
      </div>
      ${headerData.website ? `<div style="font-size: ${headerData.fontSize || '12pt'}; color: #666;">${headerData.website}</div>` : ''}
    </div>
    <hr style="border: none; border-top: 2px solid #4CAF50; margin: 20px 0;" />
  `;

  headerHTML = `
    <div style="padding: 30px; background-color: #f9f9f9;">
      ${clinicInfoHTML}
    </div>
  `;

  // Footer HTML
  const footerHTML = `
    <div style="
      background-color: ${footerData.backgroundColor};
      color: ${footerData.textColor};
      padding: 20px;
      text-align: center;
      font-size: 14px;
    ">
      ${footerData.footerText}
    </div>
  `;

  // Complete email HTML
  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
    </head>
    <body style="margin: 0; padding: 0; font-family: Arial, sans-serif; background-color: #f5f5f5;">
      <div style="max-width: 600px; margin: 0 auto; background-color: #ffffff;">
        ${headerHTML}
        
        <div style="padding: 30px;">
          <h2 style="color: #333; margin-top: 0;">Prescription Document</h2>
          
          <p style="color: #666; line-height: 1.6;">Dear Halo Health,</p>
          
          <p style="color: #666; line-height: 1.6;">
            Please find attached the electronic prescription for <strong>${patientName}</strong>. 
            This document has been digitally generated and contains all necessary prescription details with electronic signature verification.
          </p>
          
          <div style="
            background-color: #f0f7ff;
            border-left: 4px solid #4A7DFF;
            padding: 15px;
            margin: 20px 0;
          ">
            <h3 style="margin-top: 0; color: #333; font-size: 16px;">Prescription Details</h3>
            <p style="margin: 5px 0; color: #666;">
              This prescription has been electronically verified and approved by the prescribing physician.
              Please process this prescription according to standard protocols.
            </p>
          </div>
          
          <p style="color: #666; line-height: 1.6;">
            If you have any questions or require additional information, please do not hesitate to contact our clinic.
          </p>
          
          <p style="color: #666; line-height: 1.6;">Best regards,<br>Medical Team</p>
        </div>
        
        ${footerHTML}
      </div>
    </body>
    </html>
  `;
}