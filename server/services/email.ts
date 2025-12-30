import nodemailer from 'nodemailer';
import sgMail from '@sendgrid/mail';

interface EmailOptions {
  to: string;
  subject: string;
  text?: string;
  html?: string;
  from?: string;
  attachments?: Array<{
    filename: string;
    content?: Buffer;
    path?: string;
    contentType?: string;
    cid?: string;
  }>;
}

interface EmailTemplate {
  subject: string;
  html: string;
  text: string;
}

interface SendEmailReport {
  success: boolean;
  error?: string;
}

class EmailService {
  private transporter: nodemailer.Transporter;
  private initialized: boolean = false;
  private sendGridConnectionSettings: any = null;

  constructor() {
    // Initialize with fallback transporter
    this.transporter = nodemailer.createTransport({
      host: 'smtp.ethereal.email',
      port: 587,
      secure: false,
      auth: {
        user: 'test@test.com',
        pass: 'test'
      }
    });
    
    // Initialize production email service
    this.initializeProductionEmailService();
  }

  private async getSendGridCredentials() {
    try {
      const hostname = process.env.REPLIT_CONNECTORS_HOSTNAME;
      const xReplitToken = process.env.REPL_IDENTITY 
        ? 'repl ' + process.env.REPL_IDENTITY 
        : process.env.WEB_REPL_RENEWAL 
        ? 'depl ' + process.env.WEB_REPL_RENEWAL 
        : null;

      if (!xReplitToken || !hostname) {
        console.log('[EMAIL] SendGrid connector not available in this environment');
        return null;
      }

      this.sendGridConnectionSettings = await fetch(
        'https://' + hostname + '/api/v2/connection?include_secrets=true&connector_names=sendgrid',
        {
          headers: {
            'Accept': 'application/json',
            'X_REPLIT_TOKEN': xReplitToken
          }
        }
      ).then(res => res.json()).then(data => data.items?.[0]);

      if (!this.sendGridConnectionSettings || !this.sendGridConnectionSettings.settings?.api_key) {
        console.log('[EMAIL] SendGrid not properly configured');
        return null;
      }

      return {
        apiKey: this.sendGridConnectionSettings.settings.api_key,
        fromEmail: this.sendGridConnectionSettings.settings.from_email || 'noreply@curaemr.ai'
      };
    } catch (error) {
      console.error('[EMAIL] Error getting SendGrid credentials:', error);
      return null;
    }
  }

  private async initializeProductionEmailService() {
    try {
      const smtpHost = process.env.SMTP_HOST;
      const smtpPort = Number(process.env.SMTP_PORT ?? 587);
      const smtpUser = process.env.SMTP_USER;
      const smtpPass = process.env.SMTP_PASSWORD;

      if (smtpHost && smtpUser && smtpPass) {
        console.log('[EMAIL] Initializing SMTP transport from .env');
        const secure = process.env.SMTP_SECURE === 'true' || smtpPort === 465;
        this.transporter = nodemailer.createTransport({
          host: smtpHost,
          port: smtpPort,
          secure,
          auth: {
            user: smtpUser,
            pass: smtpPass,
          },
          tls: {
            rejectUnauthorized: process.env.SMTP_REJECT_UNAUTHORIZED !== 'false',
          },
          connectionTimeout: 60000,
          greetingTimeout: 30000,
          socketTimeout: 60000,
        });
        this.initialized = true;
        console.log('[EMAIL] ✅ SMTP transport configured using environment variables');
        return;
      }

      console.log('[EMAIL] SMTP env vars missing, falling back to Gmail SMTP');
      const gmailUser = process.env.GMAIL_SMTP_USER || 'noreply@curaemr.ai';
      const gmailPass = process.env.GMAIL_SMTP_PASSWORD;

      if (!gmailPass) {
        console.warn('[EMAIL] GMAIL_SMTP_PASSWORD not set in environment variables');
      }

      this.transporter = nodemailer.createTransport({
        host: 'smtp.gmail.com',
        port: 465,
        secure: true,
        auth: {
          user: gmailUser,
          pass: gmailPass || '',
        },
        debug: false,
        logger: false,
        tls: {
          rejectUnauthorized: false,
        },
        connectionTimeout: 60000,
        greetingTimeout: 30000,
        socketTimeout: 60000,
      });

      this.initialized = true;
      console.log('[EMAIL] ✅ Gmail SMTP configured for production');
    } catch (error) {
      console.error('[EMAIL] Failed to initialize email service:', error);
      this.initialized = true;
    }
  }

  private async sendWithSendGrid(options: EmailOptions): Promise<SendEmailReport> {
    try {
      const credentials = await this.getSendGridCredentials();
      if (!credentials) {
        console.log('[EMAIL] SendGrid credentials not available, will try SMTP fallback');
        return { success: false, error: "SendGrid credentials not available" };
      }

      sgMail.setApiKey(credentials.apiKey);

      // Prepare attachments in SendGrid format
      const sendGridAttachments = options.attachments?.map(att => ({
        content: att.content ? att.content.toString('base64') : '',
        filename: att.filename,
        type: att.contentType || 'application/octet-stream',
        disposition: 'attachment'
      })) || [];

      const msg = {
        to: options.to,
        from: options.from || credentials.fromEmail,
        subject: options.subject,
        text: options.text || '',
        html: options.html || '',
        attachments: sendGridAttachments
      };

      console.log('[EMAIL] Sending email via SendGrid:', {
        to: msg.to,
        from: msg.from,
        subject: msg.subject,
        attachmentsCount: sendGridAttachments.length
      });

      await sgMail.send(msg);
      console.log('[EMAIL] ✅ SendGrid email sent successfully');
      return { success: true };
    } catch (error: any) {
      const message = this.formatSendGridError(error);
      console.error('[EMAIL] SendGrid failed:', message);
      return { success: false, error: message };
    }
  }

  private formatSendGridError(error: any): string {
    if (error?.response?.body?.errors) {
      const errors = error.response.body.errors;
      if (Array.isArray(errors) && errors.length > 0) {
        return errors
          .map((err: any) => err?.message ?? err?.detail ?? "Unknown SendGrid error")
          .join(" | ");
      }
    }
    if (error?.message) {
      return error.message;
    }
    return "Unknown SendGrid error";
  }

  async sendEmail(options: EmailOptions): Promise<boolean> {
    const report = await this.sendEmailWithReport(options);
    return report.success;
  }

  async sendEmailWithReport(options: EmailOptions): Promise<SendEmailReport> {
    try {
      const sendGridResult = await this.sendWithSendGrid(options);
      if (sendGridResult.success) {
        return { success: true };
      }

      console.log('[EMAIL] SendGrid unavailable, trying SMTP fallback...');
      const smtpResult = await this.sendWithSMTP(options);
      if (smtpResult.success) {
        return { success: true };
      }

      const errorMessage =
        smtpResult.error ||
        sendGridResult.error ||
        "Unknown error while sending email via SendGrid/SMTP";
      console.log('[EMAIL] 🚨 EMAIL DELIVERY FAILED:', errorMessage);
      console.log('[EMAIL] TO:', options.to);
      console.log('[EMAIL] SUBJECT:', options.subject);
      console.log('[EMAIL] CONTENT:', options.text?.substring(0, 200));
      return { success: false, error: errorMessage };
    } catch (error: any) {
      console.error('[EMAIL] Failed to send email:', error);
      return { success: false, error: error?.message || "Unknown error" };
    }
  }

  private async sendWithSMTP(options: EmailOptions): Promise<SendEmailReport> {
    try {
      // Use only the attachments provided in options, don't add logos automatically
      const attachments = [...(options.attachments || [])];

      const fromAddress = options.from || process.env.EMAIL_FROM || process.env.SMTP_FROM || 'noreply@curaemr.ai';

      const mailOptions = {
        from: fromAddress,
        to: options.to,
        subject: options.subject,
        text: options.text,
        html: options.html,
        attachments
      };

      console.log('[EMAIL] Attempting to send email via SMTP:', {
        from: mailOptions.from,
        to: mailOptions.to,
        subject: mailOptions.subject
      });

      // Try to send the email
      try {
        const result = await this.transporter.sendMail(mailOptions);
        console.log('[EMAIL] SMTP email sent successfully:', result.messageId);
        return { success: true };
      } catch (smtpError: any) {
        console.log('[EMAIL] Primary SMTP failed:', smtpError.message);
        this.logEmailContent(mailOptions);

        // If primary fails due to domain issues, try fallback method
        if (smtpError.code === 'ENOTFOUND' || smtpError.code === 'ECONNREFUSED') {
          console.log('[EMAIL] Domain not configured, checking for fallback email credentials...');

          if (process.env.FALLBACK_EMAIL_USER && process.env.FALLBACK_EMAIL_PASS) {
            console.log('[EMAIL] Attempting fallback email delivery...');
            return await this.sendWithFallback(mailOptions);
          } else {
            console.log('[EMAIL] No fallback credentials available. Email delivery failed.');
            return { success: false, error: smtpError.message || "SMTP connection failed" };
          }
        }

        return { success: false, error: smtpError.message || "SMTP sending failed" };
      }
    } catch (error) {
      console.error('[EMAIL] Failed to send email via SMTP:', error);
      return { success: false, error: (error as Error).message || "SMTP sending failed" };
    }
  }

  private async sendWithFallback(mailOptions: any): Promise<SendEmailReport> {
    try {
      // Create new transporter with fallback credentials
      const fallbackTransporter = nodemailer.createTransport({
        service: 'gmail',
        auth: {
          user: process.env.FALLBACK_EMAIL_USER,
          pass: process.env.FALLBACK_EMAIL_PASS
        }
      });

      // Update from address to use the authenticated email
      mailOptions.from = `Cura EMR <${process.env.FALLBACK_EMAIL_USER}>`;
      
      const result = await fallbackTransporter.sendMail(mailOptions);
      console.log('[EMAIL] Fallback email sent successfully:', result.messageId);
      return { success: true };
    } catch (error) {
      console.error('[EMAIL] Fallback email also failed:', error);
      this.logEmailContent(mailOptions);
      return { success: false, error: (error as Error).message || "Fallback email failed" };
    }
  }

  private logEmailContent(mailOptions: any): void {
    console.log('[EMAIL] Email delivery failed - logging content:');
    console.log('[EMAIL] From:', mailOptions.from);
    console.log('[EMAIL] To:', mailOptions.to);
    console.log('[EMAIL] Subject:', mailOptions.subject);
    console.log('[EMAIL] Text:', mailOptions.text?.substring(0, 200) + '...');
    console.log('[EMAIL] HTML:', mailOptions.html ? 'HTML content included' : 'No HTML content');
    console.log('[EMAIL] Attachments:', mailOptions.attachments?.length || 0, 'files');
  }

  // Template for appointment reminders
  generateAppointmentReminderEmail(patientName: string, doctorName: string, appointmentDate: string, appointmentTime: string): EmailTemplate {
    const subject = `Appointment Reminder - ${appointmentDate}`;
    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background-color: #4F46E5; color: white; padding: 20px; text-align: center; }
          .content { padding: 20px; background-color: #f9f9f9; }
          .appointment-details { background-color: white; padding: 15px; border-radius: 5px; margin: 20px 0; }
          .footer { text-align: center; color: #666; font-size: 12px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>Cura EMR</h1>
            <h2>Appointment Reminder</h2>
          </div>
          <div class="content">
            <p>Dear ${patientName},</p>
            <p>This is a friendly reminder about your upcoming appointment:</p>
            
            <div class="appointment-details">
              <h3>Appointment Details</h3>
              <p><strong>Date:</strong> ${appointmentDate}</p>
              <p><strong>Time:</strong> ${appointmentTime}</p>
              <p><strong>Doctor:</strong> ${doctorName}</p>
            </div>
            
            <p>Please arrive 15 minutes early for check-in.</p>
            <p>If you need to reschedule or have any questions, please contact us.</p>
            
            <p>Best regards,<br>Cura EMR Team</p>
          </div>
          <div class="footer">
            <p>© 2025 Cura EMR by Halo Group. All rights reserved.</p>
          </div>
        </div>
      </body>
      </html>
    `;
    
    const text = `
Dear ${patientName},

This is a friendly reminder about your upcoming appointment:

Date: ${appointmentDate}
Time: ${appointmentTime}
Doctor: ${doctorName}

Please arrive 15 minutes early for check-in.
If you need to reschedule or have any questions, please contact us.

Best regards,
Cura EMR Team
    `;

    return { subject, html, text };
  }

  // Template for prescription notifications
  generatePrescriptionNotificationEmail(patientName: string, medicationName: string, dosage: string, instructions: string): EmailTemplate {
    const subject = `New Prescription - ${medicationName}`;
    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background-color: #10B981; color: white; padding: 20px; text-align: center; }
          .content { padding: 20px; background-color: #f9f9f9; }
          .prescription-details { background-color: white; padding: 15px; border-radius: 5px; margin: 20px 0; }
          .footer { text-align: center; color: #666; font-size: 12px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>Cura EMR</h1>
            <h2>New Prescription</h2>
          </div>
          <div class="content">
            <p>Dear ${patientName},</p>
            <p>A new prescription has been issued for you:</p>
            
            <div class="prescription-details">
              <h3>Prescription Details</h3>
              <p><strong>Medication:</strong> ${medicationName}</p>
              <p><strong>Dosage:</strong> ${dosage}</p>
              <p><strong>Instructions:</strong> ${instructions}</p>
            </div>
            
            <p>Please collect your prescription from the pharmacy and follow the instructions carefully.</p>
            <p>If you have any questions about this medication, please contact your healthcare provider.</p>
            
            <p>Best regards,<br>Cura EMR Team</p>
          </div>
          <div class="footer">
            <p>© 2025 Cura EMR by Halo Group. All rights reserved.</p>
          </div>
        </div>
      </body>
      </html>
    `;
    
    const text = `
Dear ${patientName},

A new prescription has been issued for you:

Medication: ${medicationName}
Dosage: ${dosage}
Instructions: ${instructions}

Please collect your prescription from the pharmacy and follow the instructions carefully.
If you have any questions about this medication, please contact your healthcare provider.

Best regards,
Cura EMR Team
    `;

    return { subject, html, text };
  }

  // Template for test results
  generateTestResultsEmail(patientName: string, testName: string, status: string): EmailTemplate {
    const subject = `Test Results Available - ${testName}`;
    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background-color: #3B82F6; color: white; padding: 20px; text-align: center; }
          .content { padding: 20px; background-color: #f9f9f9; }
          .results-details { background-color: white; padding: 15px; border-radius: 5px; margin: 20px 0; }
          .footer { text-align: center; color: #666; font-size: 12px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>Cura EMR</h1>
            <h2>Test Results Available</h2>
          </div>
          <div class="content">
            <p>Dear ${patientName},</p>
            <p>Your test results are now available:</p>
            
            <div class="results-details">
              <h3>Test Information</h3>
              <p><strong>Test Name:</strong> ${testName}</p>
              <p><strong>Status:</strong> ${status}</p>
            </div>
            
            <p>Please log into your patient portal or contact your healthcare provider to discuss the results.</p>
            <p>If you have any questions or concerns, please don't hesitate to reach out.</p>
            
            <p>Best regards,<br>Cura EMR Team</p>
          </div>
          <div class="footer">
            <p>© 2025 Cura EMR by Halo Group. All rights reserved.</p>
          </div>
        </div>
      </body>
      </html>
    `;
    
    const text = `
Dear ${patientName},

Your test results are now available:

Test Name: ${testName}
Status: ${status}

Please log into your patient portal or contact your healthcare provider to discuss the results.
If you have any questions or concerns, please don't hesitate to reach out.

Best regards,
Cura EMR Team
    `;

    return { subject, html, text };
  }

  // Send appointment reminder
  async sendAppointmentReminder(patientEmail: string, patientName: string, doctorName: string, appointmentDate: string, appointmentTime: string): Promise<boolean> {
    const template = this.generateAppointmentReminderEmail(patientName, doctorName, appointmentDate, appointmentTime);
    return this.sendEmail({
      to: patientEmail,
      subject: template.subject,
      html: template.html,
      text: template.text
    });
  }

  // Send prescription notification
  async sendPrescriptionNotification(patientEmail: string, patientName: string, medicationName: string, dosage: string, instructions: string): Promise<boolean> {
    const template = this.generatePrescriptionNotificationEmail(patientName, medicationName, dosage, instructions);
    return this.sendEmail({
      to: patientEmail,
      subject: template.subject,
      html: template.html,
      text: template.text
    });
  }

  // Send test results notification
  async sendTestResultsNotification(patientEmail: string, patientName: string, testName: string, status: string): Promise<boolean> {
    const template = this.generateTestResultsEmail(patientName, testName, status);
    return this.sendEmail({
      to: patientEmail,
      subject: template.subject,
      html: template.html,
      text: template.text
    });
  }

  // Template for general reminders (medication, follow-up, etc.)
  generateGeneralReminderEmail(patientName: string, reminderType: string, message: string): EmailTemplate {
    const typeLabels: Record<string, string> = {
      'appointment_reminder': 'Appointment Reminder',
      'medication_reminder': 'Medication Reminder', 
      'follow_up_reminder': 'Follow-up Reminder',
      'emergency_alert': 'Emergency Alert',
      'preventive_care': 'Preventive Care Reminder',
      'billing_notice': 'Billing Notice',
      'health_check': 'Health Check Reminder'
    };
    
    const subject = `${typeLabels[reminderType] || 'Healthcare Reminder'} - Cura EMR`;
    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background-color: #4F46E5; color: white; padding: 20px; text-align: center; }
          .content { padding: 20px; background-color: #f9f9f9; }
          .reminder-details { background-color: white; padding: 15px; border-radius: 5px; margin: 20px 0; }
          .footer { text-align: center; color: #666; font-size: 12px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>Cura EMR</h1>
            <h2>${typeLabels[reminderType] || 'Healthcare Reminder'}</h2>
          </div>
          <div class="content">
            <p>Dear ${patientName},</p>
            
            <div class="reminder-details">
              <h3>Reminder Message</h3>
              <p>${message}</p>
            </div>
            
            <p>If you have any questions or need to reschedule, please contact your healthcare provider.</p>
            
            <p>Best regards,<br>Cura EMR Team</p>
          </div>
          <div class="footer">
            <p>© 2025 Cura EMR by Halo Group. All rights reserved.</p>
          </div>
        </div>
      </body>
      </html>
    `;
    
    const text = `
Dear ${patientName},

${typeLabels[reminderType] || 'Healthcare Reminder'}

${message}

If you have any questions or need to reschedule, please contact your healthcare provider.

Best regards,
Cura EMR Team
    `;

    return { subject, html, text };
  }

  // Send general reminder
  async sendGeneralReminder(patientEmail: string, patientName: string, reminderType: string, message: string): Promise<boolean> {
    const template = this.generateGeneralReminderEmail(patientName, reminderType, message);
    return this.sendEmail({
      to: patientEmail,
      subject: template.subject,
      html: template.html,
      text: template.text
    });
  }

  // Template for password change notification
  generatePasswordChangeEmail(userName: string, timestamp: string): EmailTemplate {
    const subject = `Password Changed - Cura EMR`;
    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background-color: #EF4444; color: white; padding: 20px; text-align: center; }
          .content { padding: 20px; background-color: #f9f9f9; }
          .alert-box { background-color: #FEE2E2; border-left: 4px solid #EF4444; padding: 15px; margin: 20px 0; }
          .details-box { background-color: white; padding: 15px; border-radius: 5px; margin: 20px 0; }
          .footer { text-align: center; color: #666; font-size: 12px; }
          .warning { color: #DC2626; font-weight: bold; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>Cura EMR</h1>
            <h2>Password Changed</h2>
          </div>
          <div class="content">
            <p>Dear ${userName},</p>
            
            <div class="alert-box">
              <p class="warning">⚠️ Your password was successfully changed</p>
            </div>
            
            <div class="details-box">
              <h3>Change Details</h3>
              <p><strong>Date & Time:</strong> ${timestamp}</p>
              <p><strong>Account:</strong> ${userName}</p>
            </div>
            
            <p>If you did not make this change, please contact your system administrator immediately and secure your account.</p>
            
            <p>For security reasons:</p>
            <ul>
              <li>Never share your password with anyone</li>
              <li>Use a strong, unique password</li>
              <li>Change your password regularly</li>
              <li>Enable two-factor authentication if available</li>
            </ul>
            
            <p>Best regards,<br>Cura EMR Security Team</p>
          </div>
          <div class="footer">
            <p>© 2025 Cura EMR by Halo Group. All rights reserved.</p>
            <p>This is an automated security notification.</p>
          </div>
        </div>
      </body>
      </html>
    `;
    
    const text = `
Dear ${userName},

⚠️ PASSWORD CHANGED

Your Cura EMR account password was successfully changed.

Change Details:
Date & Time: ${timestamp}
Account: ${userName}

If you did not make this change, please contact your system administrator immediately and secure your account.

Security Best Practices:
- Never share your password with anyone
- Use a strong, unique password
- Change your password regularly
- Enable two-factor authentication if available

Best regards,
Cura EMR Security Team

© 2025 Cura EMR by Halo Group. All rights reserved.
This is an automated security notification.
    `;

    return { subject, html, text };
  }

  // Send password change notification
  async sendPasswordChangeNotification(userEmail: string, userName: string): Promise<boolean> {
    const timestamp = new Date().toLocaleString('en-GB', {
      day: '2-digit',
      month: 'long',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false
    });
    
    const template = this.generatePasswordChangeEmail(userName, timestamp);
    return this.sendEmail({
      to: userEmail,
      subject: template.subject,
      html: template.html,
      text: template.text
    });
  }

  // Template for sharing imaging studies
  generateImagingStudyShareEmail(recipientEmail: string, patientName: string, studyType: string, sharedBy: string, customMessage: string = '', reportUrl?: string): EmailTemplate {
    const subject = `Imaging Study Shared - ${patientName}`;
    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background-color: #4F46E5; color: white; padding: 20px; text-align: center; }
          .content { padding: 20px; background-color: #f9f9f9; }
          .study-details { background-color: white; padding: 15px; border-radius: 5px; margin: 20px 0; }
          .custom-message { background-color: #FEF3C7; border-left: 4px solid #F59E0B; padding: 15px; margin: 20px 0; }
          .report-link { background-color: #DBEAFE; border: 1px solid #3B82F6; border-radius: 5px; padding: 15px; text-align: center; margin: 20px 0; }
          .footer { text-align: center; color: #666; font-size: 12px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>Cura EMR</h1>
            <h2>Imaging Study Shared</h2>
          </div>
          <div class="content">
            <p>Dear Colleague,</p>
            <p>An imaging study has been shared with you by ${sharedBy}:</p>
            
            <div class="study-details">
              <h3>Study Information</h3>
              <p><strong>Patient:</strong> ${patientName}</p>
              <p><strong>Study Type:</strong> ${studyType}</p>
              <p><strong>Shared by:</strong> ${sharedBy}</p>
              <p><strong>Date Shared:</strong> ${new Date().toLocaleDateString()}</p>
            </div>
            
            ${customMessage ? `
            <div class="custom-message">
              <h4>Message from ${sharedBy}:</h4>
              <p>${customMessage}</p>
            </div>
            ` : ''}
            
            ${reportUrl ? `
            <div class="report-link">
              <h4>Report Access</h4>
              <p>Click the link below to view the imaging report:</p>
              <a href="${reportUrl}" style="display: inline-block; background-color: #3B82F6; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px; margin-top: 10px;">View Report</a>
            </div>
            ` : ''}
            
            <p>This study has been shared for medical consultation purposes. Please ensure appropriate patient confidentiality is maintained.</p>
            
            <p>Best regards,<br>Cura EMR Team</p>
          </div>
          <div class="footer">
            <p>© 2025 Cura EMR by Halo Group. All rights reserved.</p>
          </div>
        </div>
      </body>
      </html>
    `;
    
    const text = `
Dear Colleague,

An imaging study has been shared with you by ${sharedBy}:

Patient: ${patientName}
Study Type: ${studyType}  
Shared by: ${sharedBy}
Date Shared: ${new Date().toLocaleDateString()}

${customMessage ? `Message from ${sharedBy}: ${customMessage}` : ''}

${reportUrl ? `Report URL: ${reportUrl}` : ''}

This study has been shared for medical consultation purposes. Please ensure appropriate patient confidentiality is maintained.

Best regards,
Cura EMR Team
    `;

    return { subject, html, text };
  }

  // Send imaging study share email
  async sendImagingStudyShare(recipientEmail: string, patientName: string, studyType: string, sharedBy: string, customMessage: string = '', reportUrl?: string): Promise<boolean> {
    const template = this.generateImagingStudyShareEmail(recipientEmail, patientName, studyType, sharedBy, customMessage, reportUrl);
    return this.sendEmail({
      to: recipientEmail,
      subject: template.subject,
      html: template.html,
      text: template.text
    });
  }

  // Template for prescription PDF emails with clinic logo in header and Cura logo in footer
  generatePrescriptionEmail(
    patientName: string, 
    pharmacyName: string, 
    prescriptionData?: any,
    clinicLogoUrl?: string,
    organizationName?: string,
    hasAttachments: boolean = true
  ): EmailTemplate {
    const subject = `Prescription PDF - ${patientName}`;
    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { 
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif; 
            line-height: 1.6; 
            color: #333; 
            margin: 0; 
            padding: 0; 
            background-color: #f8fafc;
          }
          .container { 
            max-width: 600px; 
            margin: 0 auto; 
            background-color: white; 
            box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
          }
          .header { 
            background: linear-gradient(135deg, #4F46E5 0%, #7C3AED 100%);
            color: white;
            padding: 20px 30px;
            display: flex;
            align-items: center;
            gap: 35px;
            position: relative;
          }
          .clinic-logo {
            width: 80px;
            height: 80px;
            border-radius: 12px;
            object-fit: contain;
            background: white;
            padding: 12px;
            flex-shrink: 0;
            box-shadow: 0 4px 15px rgba(0, 0, 0, 0.2);
          }
          .fallback-logo {
            background: white;
            border-radius: 12px;
            flex-shrink: 0;
            box-shadow: 0 4px 15px rgba(0, 0, 0, 0.2);
            border-collapse: collapse;
          }
          .header-info {
            flex: 1;
            display: flex;
            flex-direction: column;
            gap: 2px;
          }
          .clinic-name {
            font-size: 24px;
            font-weight: 700;
            color: white;
            margin: 0 0 4px 0;
            line-height: 1.1;
            text-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
          }
          .clinic-tagline {
            font-size: 13px;
            color: rgba(255, 255, 255, 0.95);
            margin: 0;
            text-transform: uppercase;
            letter-spacing: 1px;
            font-weight: 600;
          }
          .header h1 { 
            margin: 0; 
            font-size: 28px; 
            font-weight: 700;
            color: white;
            text-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
          }
          .header p { 
            margin: 5px 0 0; 
            opacity: 0.9; 
            font-size: 16px;
            color: rgba(255, 255, 255, 0.9);
          }
          .content { 
            padding: 40px 30px; 
          }
          .prescription-details { 
            background: linear-gradient(135deg, #EEF2FF 0%, #F3E8FF 100%); 
            padding: 25px; 
            border-radius: 12px; 
            margin: 25px 0; 
            border-left: 4px solid #4F46E5;
          }
          .detail-item {
            margin: 12px 0;
            padding: 8px 0;
            border-bottom: 1px solid rgba(79, 70, 229, 0.1);
          }
          .detail-item:last-child {
            border-bottom: none;
          }
          .detail-label {
            font-weight: 600;
            color: #4F46E5;
            display: inline-block;
            width: 120px;
          }
          .detail-value {
            color: #1f2937;
          }
          .attachment-notice {
            background: #F0FDF4;
            border: 2px dashed #22C55E;
            border-radius: 8px;
            padding: 20px;
            text-align: center;
            margin: 25px 0;
          }
          .attachment-icon {
            font-size: 32px;
            margin-bottom: 10px;
            color: #22C55E;
          }
          .footer { 
            background: #f8fafc;
            padding: 15px 30px 10px; 
            text-align: center; 
            border-top: 1px solid #e5e7eb;
          }
          .footer-logo {
            width: 80px;
            height: 80px;
            background: white;
            border-radius: 12px;
            margin: 0 auto 8px;
            display: flex;
            align-items: center;
            justify-content: center;
            font-weight: bold;
            color: white;
            font-size: 18px;
            box-shadow: 0 4px 20px rgba(79, 70, 229, 0.3);
            border: 3px solid #4F46E5;
            padding: 10px;
          }
          .footer-brand {
            color: #6b7280;
            font-size: 14px;
            margin-bottom: 5px;
          }
          .footer-text {
            color: #9ca3af; 
            font-size: 12px; 
            line-height: 1.4;
            margin: 0;
          }
          .btn {
            display: inline-block;
            background: linear-gradient(135deg, #4F46E5 0%, #7C3AED 100%);
            color: white;
            padding: 12px 24px;
            text-decoration: none;
            border-radius: 6px;
            font-weight: 500;
            margin: 10px 0;
          }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            ${clinicLogoUrl ? 
              `<img src="${clinicLogoUrl}" alt="${organizationName || 'Medical Clinic'} Logo" class="clinic-logo">
               <div class="header-info">
                 <h1 class="clinic-name" style="color: grey;">${organizationName || 'Medical Clinic'}</h1>
                 <p class="clinic-tagline" style="color: grey;">Powered by Cura EMR Platform</p>
               </div>` :
              `<div class="fallback-logo" style="width: 95px; height: 95px; margin-right: 20px; background: darkblue; border-radius: 12px; display: flex; align-items: center; justify-content: center; color: black; font-size: 32px; font-weight: bold; box-shadow: 0 4px 20px rgba(74, 125, 255, 0.3);">
                 C
               </div>
               <div class="header-info">
                 <h1 class="clinic-name" style="color: grey;">Cura EMR</h1>
                 <p class="clinic-tagline" style="color: grey;">AI-Powered Healthcare Platform</p>
               </div>`
            }
          </div>
          
          <div class="content">
            <h2 style="color: #1f2937; margin-bottom: 20px;">Prescription Document</h2>
            
            <p style="font-size: 16px; color: #4b5563;">Dear ${pharmacyName || 'Pharmacy Team'},</p>
            
            <p style="font-size: 16px; line-height: 1.6; color: #4b5563;">
              Please find attached the electronic prescription for <strong>${patientName}</strong>. 
              This document has been digitally generated and contains all necessary prescription details 
              with electronic signature verification.
            </p>

            <div class="prescription-details">
              <h3 style="color: #4F46E5; margin-top: 0; margin-bottom: 15px;">Prescription Details</h3>
              <div class="detail-item">
                <span class="detail-label">Patient:</span>
                <span class="detail-value">${patientName}</span>
              </div>
              <div class="detail-item">
                <span class="detail-label">Document:</span>
                <span class="detail-value">Electronic Prescription (PDF)</span>
              </div>
              <div class="detail-item">
                <span class="detail-label">System:</span>
                <span class="detail-value">Cura EMR Platform</span>
              </div>
              <div class="detail-item">
                <span class="detail-label">Generated:</span>
                <span class="detail-value">${new Date().toLocaleDateString('en-GB')} at ${new Date().toLocaleTimeString('en-GB')}</span>
              </div>
            </div>

            ${hasAttachments ? `<div class="attachment-notice">
              <div class="attachment-icon">📄</div>
              <h3 style="color: #15803d; margin: 0 0 8px 0;">PDF Attachment Included</h3>
              <p style="margin: 0; color: #166534;">
                The complete prescription document is attached to this email as a PDF file.
                <br>Please review and process according to your standard procedures.
              </p>
            </div>` : ''}

            <h3 style="color: #1f2937; margin-top: 30px;">Important Notes:</h3>
            <ul style="color: #4b5563; line-height: 1.6; padding-left: 20px;">
              <li>This prescription has been electronically signed and verified</li>
              <li>Please check the PDF attachment for complete medication details</li>
              <li>Contact our system if you need any clarification</li>
              <li>Maintain confidentiality as per healthcare regulations</li>
            </ul>

            <p style="color: #4b5563; margin-top: 30px;">
              Thank you for your professional service.
            </p>
          </div>
          
          <div class="footer">
            ${clinicLogoUrl ? `
              <div style="margin-bottom: 15px;">
                <img src="${clinicLogoUrl}" alt="${organizationName || 'Clinic'} Logo" style="width: 80px; height: 80px; object-fit: contain; border-radius: 8px; background: white; padding: 8px; box-shadow: 0 2px 8px rgba(0,0,0,0.1);">
              </div>
            ` : ''}
            <div class="footer-brand">Powered by Cura EMR</div>
            <p class="footer-text">
              This email was automatically generated by the Cura EMR system.<br>
              For technical support, please contact your system administrator.<br>
              © 2025 Cura Software Limited. All rights reserved.
            </p>
          </div>
        </div>
      </body>
      </html>
    `;
    
    const text = `
Prescription Document

Dear ${pharmacyName || 'Pharmacy Team'},

Please find attached the electronic prescription for ${patientName}.
This document has been digitally generated and contains all necessary prescription details with electronic signature verification.

Prescription Details:
- Patient: ${patientName}
- Document: Electronic Prescription (PDF)
- System: Cura EMR Platform
- Generated: ${new Date().toLocaleDateString('en-GB')} at ${new Date().toLocaleTimeString('en-GB')}

${hasAttachments ? `PDF Attachment Included
The complete prescription document is attached to this email as a PDF file.
Please review and process according to your standard procedures.

` : ''}Important Notes:
- This prescription has been electronically signed and verified
- Please check the PDF attachment for complete medication details
- Contact our system if you need any clarification
- Maintain confidentiality as per healthcare regulations

Thank you for your professional service.

---
Powered by Cura EMR
This email was automatically generated by the Cura EMR system.
For technical support, please contact your system administrator.
© 2025 Cura Software Limited. All rights reserved.
    `;

    return { subject, html, text };
  }

  // Send prescription email with PDF attachment
  async sendPrescriptionEmail(
    pharmacyEmail: string, 
    patientName: string, 
    pharmacyName: string, 
    pdfBuffer: Buffer,
    prescriptionData?: any,
    clinicLogoUrl?: string,
    organizationName?: string
  ): Promise<boolean> {
    const template = this.generatePrescriptionEmail(patientName, pharmacyName, prescriptionData, clinicLogoUrl, organizationName);
    
    return this.sendEmail({
      to: pharmacyEmail,
      subject: template.subject,
      html: template.html,
      text: template.text,
      attachments: [
        {
          filename: `prescription-${patientName.replace(/\s+/g, '-')}-${Date.now()}.pdf`,
          content: pdfBuffer,
          contentType: 'application/pdf'
        }
      ]
    });
  }

  // Template for new user account creation
  generateNewUserAccountEmail(
    userName: string, 
    userEmail: string, 
    password: string,
    organizationName: string,
    role: string
  ): EmailTemplate {
    const subject = `Welcome to Cura EMR - Your Account Has Been Created`;
    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { 
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif; 
            line-height: 1.6; 
            color: #333; 
          }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; background-color: #ffffff; }
          .header { 
            background: linear-gradient(135deg, #4A7DFF 0%, #7279FB 100%); 
            color: white; 
            padding: 30px 20px; 
            text-align: center; 
            border-radius: 8px 8px 0 0;
          }
          .header h1 { margin: 0; font-size: 28px; font-weight: 600; }
          .content { padding: 30px 20px; background-color: #f9fafb; }
          .welcome-message { 
            background-color: #ffffff; 
            padding: 20px; 
            border-radius: 8px; 
            margin-bottom: 20px;
            border-left: 4px solid #4A7DFF;
          }
          .credentials-box { 
            background-color: #ffffff; 
            padding: 20px; 
            border-radius: 8px; 
            margin: 20px 0;
            border: 2px solid #e5e7eb;
          }
          .credential-item { 
            margin: 12px 0; 
            padding: 12px;
            background-color: #f3f4f6;
            border-radius: 6px;
          }
          .credential-label { 
            font-weight: 600; 
            color: #4A7DFF; 
            font-size: 13px;
            text-transform: uppercase;
            letter-spacing: 0.5px;
          }
          .credential-value { 
            font-size: 16px; 
            color: #1f2937; 
            font-family: 'Courier New', monospace;
            margin-top: 4px;
          }
          .warning-box {
            background-color: #FEF3C7;
            border-left: 4px solid #F59E0B;
            padding: 15px;
            margin: 20px 0;
            border-radius: 4px;
          }
          .warning-box p {
            margin: 0;
            color: #92400E;
          }
          .footer { 
            text-align: center; 
            color: #6b7280; 
            font-size: 12px; 
            padding: 20px;
            border-top: 1px solid #e5e7eb;
          }
          .button {
            display: inline-block;
            background-color: #4A7DFF;
            color: white;
            padding: 12px 30px;
            text-decoration: none;
            border-radius: 6px;
            margin: 20px 0;
            font-weight: 500;
          }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>Welcome to Cura EMR</h1>
            <p style="margin: 10px 0 0 0; font-size: 16px;">Your Healthcare Management Platform</p>
          </div>
          
          <div class="content">
            <div class="welcome-message">
              <h2 style="margin-top: 0; color: #1f2937;">Hello ${userName}!</h2>
              <p>Your account has been successfully created at <strong>${organizationName}</strong>.</p>
              <p>You have been assigned the role of <strong>${role}</strong> and can now access the Cura EMR system.</p>
            </div>
            
            <div class="credentials-box">
              <h3 style="margin-top: 0; color: #1f2937;">Your Login Credentials</h3>
              
              <div class="credential-item">
                <div class="credential-label">Email Address</div>
                <div class="credential-value">${userEmail}</div>
              </div>
              
              <div class="credential-item">
                <div class="credential-label">Temporary Password</div>
                <div class="credential-value">${password}</div>
              </div>
              
              <div class="credential-item">
                <div class="credential-label">Organization</div>
                <div class="credential-value">${organizationName}</div>
              </div>
              
              <div class="credential-item">
                <div class="credential-label">Role</div>
                <div class="credential-value">${role}</div>
              </div>
            </div>

            <div class="warning-box">
              <p><strong>⚠️ Security Notice:</strong> For your security, please change your password after your first login. Keep your credentials confidential and do not share them with anyone.</p>
            </div>
            
            <div style="text-align: center; margin: 30px 0;">
              <p>Ready to get started? Click the button below to log in:</p>
              <a href="https://app.curaemr.ai/auth/login" class="button">Login to Cura EMR</a>
            </div>

            <div style="background-color: #ffffff; padding: 20px; border-radius: 8px; margin-top: 20px;">
              <h3 style="margin-top: 0; color: #1f2937;">Next Steps</h3>
              <ol style="color: #4b5563; line-height: 1.8;">
                <li>Log in using your email and temporary password</li>
                <li>Complete your profile setup</li>
                <li>Change your password to something secure</li>
                <li>Explore the platform features</li>
              </ol>
            </div>

            <p style="margin-top: 30px; color: #6b7280;">If you have any questions or need assistance, please contact your system administrator.</p>
          </div>
          
          <div class="footer">
            <p style="margin: 0 0 10px 0;"><strong>Cura Software Limited</strong></p>
            <p style="margin: 0;">Ground Floor Unit 2, Drayton Court, Drayton Road</p>
            <p style="margin: 0;">Solihull, England B90 4NG</p>
            <p style="margin: 10px 0 0 0;">Company Registration: 16556912</p>
            <p style="margin: 10px 0 0 0;">© 2025 Cura Software Limited. All rights reserved.</p>
          </div>
        </div>
      </body>
      </html>
    `;
    
    const text = `
Welcome to Cura EMR!

Hello ${userName},

Your account has been successfully created at ${organizationName}.
You have been assigned the role of ${role}.

YOUR LOGIN CREDENTIALS:
━━━━━━━━━━━━━━━━━━━━━━━━━
Email Address: ${userEmail}
Temporary Password: ${password}
Organization: ${organizationName}
Role: ${role}

⚠️ SECURITY NOTICE:
For your security, please change your password after your first login.
Keep your credentials confidential and do not share them with anyone.

NEXT STEPS:
1. Log in at: https://app.curaemr.ai/auth/login
2. Complete your profile setup
3. Change your password to something secure
4. Explore the platform features

If you have any questions or need assistance, please contact your system administrator.

━━━━━━━━━━━━━━━━━━━━━━━━━
Cura Software Limited
Ground Floor Unit 2, Drayton Court, Drayton Road
Solihull, England B90 4NG
Company Registration: 16556912

© 2025 Cura Software Limited. All rights reserved.
    `;

    return { subject, html, text };
  }

  // Send new user account email
  async sendNewUserAccountEmail(
    userEmail: string,
    userName: string,
    password: string,
    organizationName: string,
    role: string
  ): Promise<boolean> {
    const template = this.generateNewUserAccountEmail(userName, userEmail, password, organizationName, role);
    return this.sendEmail({
      to: userEmail,
      subject: template.subject,
      html: template.html,
      text: template.text
    });
  }

  generatePasswordResetEmail(userFirstName: string, resetToken: string): EmailTemplate {
    const baseUrl = process.env.REPLIT_DEV_DOMAIN || 'your-domain.com';
    const resetUrl = `https://${baseUrl}/auth/reset-password?token=${resetToken}`;
    const subject = 'Password Reset Request - Cura EMR';
    
    const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Password Reset Request</title>
</head>
<body style="margin: 0; padding: 0; font-family: 'Arial', sans-serif; background-color: #f4f7fa;">
  <table role="presentation" style="width: 100%; border-collapse: collapse; background-color: #f4f7fa;">
    <tr>
      <td align="center" style="padding: 40px 0;">
        <table role="presentation" style="width: 600px; border-collapse: collapse; background-color: #ffffff; border-radius: 8px; box-shadow: 0 2px 8px rgba(0,0,0,0.1);">
          <tr>
            <td style="padding: 40px 40px 30px 40px; background: linear-gradient(135deg, #4A7DFF 0%, #7279FB 100%); border-radius: 8px 8px 0 0;">
              <h1 style="margin: 0; color: #ffffff; font-size: 28px; font-weight: bold; text-align: center;">
                Cura EMR
              </h1>
            </td>
          </tr>
          
          <tr>
            <td style="padding: 40px;">
              <h2 style="margin: 0 0 20px 0; color: #2d3748; font-size: 24px; font-weight: 600;">
                Password Reset Request
              </h2>
              
              <p style="margin: 0 0 20px 0; color: #4a5568; font-size: 16px; line-height: 1.6;">
                Hello ${userFirstName},
              </p>
              
              <p style="margin: 0 0 30px 0; color: #4a5568; font-size: 16px; line-height: 1.6;">
                You requested to reset your password for your Cura EMR account. Click the button below to create a new password:
              </p>
              
              <table role="presentation" style="width: 100%; border-collapse: collapse;">
                <tr>
                  <td align="center" style="padding: 20px 0;">
                    <a href="${resetUrl}" 
                       style="display: inline-block; padding: 16px 40px; background-color: #4A7DFF; color: #ffffff; text-decoration: none; border-radius: 6px; font-size: 16px; font-weight: 600; box-shadow: 0 4px 6px rgba(74, 125, 255, 0.3);">
                      Reset Password
                    </a>
                  </td>
                </tr>
              </table>
              
              <p style="margin: 30px 0 20px 0; color: #718096; font-size: 14px; line-height: 1.6;">
                Or copy and paste this URL into your browser:
              </p>
              
              <p style="margin: 0 0 30px 0; padding: 15px; background-color: #f7fafc; border-radius: 4px; color: #4A7DFF; font-size: 14px; word-break: break-all; border-left: 4px solid #4A7DFF;">
                ${resetUrl}
              </p>
              
              <div style="margin: 30px 0; padding: 20px; background-color: #fff5f5; border-left: 4px solid #f56565; border-radius: 4px;">
                <p style="margin: 0; color: #c53030; font-size: 14px; line-height: 1.6;">
                  <strong>Important:</strong> This link will expire in 1 hour for security reasons.
                </p>
              </div>
              
              <p style="margin: 30px 0 0 0; color: #718096; font-size: 14px; line-height: 1.6;">
                If you did not request a password reset, please ignore this email and your password will remain unchanged.
              </p>
            </td>
          </tr>
          
          <tr>
            <td style="padding: 30px 40px; background-color: #f7fafc; border-radius: 0 0 8px 8px; border-top: 1px solid #e2e8f0;">
              <p style="margin: 0 0 10px 0; color: #718096; font-size: 14px; text-align: center;">
                Best regards,<br>
                <strong style="color: #4a5568;">Cura EMR Team</strong>
              </p>
              
              <p style="margin: 20px 0 0 0; color: #a0aec0; font-size: 12px; text-align: center; line-height: 1.5;">
                This is an automated message. Please do not reply to this email.<br>
                &copy; ${new Date().getFullYear()} Cura EMR. All rights reserved.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
    `;
    
    const text = `Hello ${userFirstName},

You requested to reset your password for your Cura EMR account.

Please click the following link to reset your password:
${resetUrl}

This link will expire in 1 hour.

If you did not request a password reset, please ignore this email and your password will remain unchanged.

Best regards,
Cura EMR Team`;
    
    return { subject, html, text };
  }

  async sendPasswordResetEmail(toEmail: string, resetToken: string, userFirstName: string): Promise<boolean> {
    const template = this.generatePasswordResetEmail(userFirstName, resetToken);
    return this.sendEmail({
      to: toEmail,
      subject: template.subject,
      html: template.html,
      text: template.text
    });
  }

  generatePasswordResetConfirmationEmail(userFirstName: string): EmailTemplate {
    const subject = 'Password Successfully Changed - Cura EMR';
    const baseUrl = process.env.REPLIT_DEV_DOMAIN || 'your-domain.com';
    const loginUrl = `https://${baseUrl}/auth/login`;
    
    const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Password Changed</title>
</head>
<body style="margin: 0; padding: 0; font-family: 'Arial', sans-serif; background-color: #f4f7fa;">
  <table role="presentation" style="width: 100%; border-collapse: collapse; background-color: #f4f7fa;">
    <tr>
      <td align="center" style="padding: 40px 0;">
        <table role="presentation" style="width: 600px; border-collapse: collapse; background-color: #ffffff; border-radius: 8px; box-shadow: 0 2px 8px rgba(0,0,0,0.1);">
          <tr>
            <td style="padding: 40px 40px 30px 40px; background: linear-gradient(135deg, #48bb78 0%, #38a169 100%); border-radius: 8px 8px 0 0;">
              <h1 style="margin: 0; color: #ffffff; font-size: 28px; font-weight: bold; text-align: center;">
                Cura EMR
              </h1>
            </td>
          </tr>
          
          <tr>
            <td style="padding: 40px;">
              <div style="text-align: center; margin-bottom: 20px;">
                <div style="display: inline-block; width: 60px; height: 60px; background-color: #c6f6d5; border-radius: 50%; padding: 15px;">
                  <svg width="30" height="30" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" style="display: block; margin: 0 auto;">
                    <path d="M5 13l4 4L19 7" stroke="#38a169" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>
                  </svg>
                </div>
              </div>
              
              <h2 style="margin: 0 0 20px 0; color: #2d3748; font-size: 24px; font-weight: 600; text-align: center;">
                Password Successfully Changed
              </h2>
              
              <p style="margin: 0 0 20px 0; color: #4a5568; font-size: 16px; line-height: 1.6; text-align: center;">
                Hello ${userFirstName},
              </p>
              
              <p style="margin: 0 0 30px 0; color: #4a5568; font-size: 16px; line-height: 1.6; text-align: center;">
                Your password has been successfully changed for your Cura EMR account.
              </p>
              
              <div style="margin: 30px 0; padding: 20px; background-color: #fffaf0; border-left: 4px solid #ed8936; border-radius: 4px;">
                <p style="margin: 0; color: #7c2d12; font-size: 14px; line-height: 1.6;">
                  <strong>Security Notice:</strong> If you did not make this change, please contact our support team immediately to secure your account.
                </p>
              </div>
              
              <table role="presentation" style="width: 100%; border-collapse: collapse;">
                <tr>
                  <td align="center" style="padding: 20px 0;">
                    <a href="${loginUrl}" 
                       style="display: inline-block; padding: 16px 40px; background-color: #4A7DFF; color: #ffffff; text-decoration: none; border-radius: 6px; font-size: 16px; font-weight: 600; box-shadow: 0 4px 6px rgba(74, 125, 255, 0.3);">
                      Sign In
                    </a>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          
          <tr>
            <td style="padding: 30px 40px; background-color: #f7fafc; border-radius: 0 0 8px 8px; border-top: 1px solid #e2e8f0;">
              <p style="margin: 0 0 10px 0; color: #718096; font-size: 14px; text-align: center;">
                Best regards,<br>
                <strong style="color: #4a5568;">Cura EMR Team</strong>
              </p>
              
              <p style="margin: 20px 0 0 0; color: #a0aec0; font-size: 12px; text-align: center; line-height: 1.5;">
                This is an automated message. Please do not reply to this email.<br>
                &copy; ${new Date().getFullYear()} Cura EMR. All rights reserved.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
    `;
    
    const text = `Hello ${userFirstName},

Your password has been successfully changed for your Cura EMR account.

If you did not make this change, please contact our support team immediately.

You can now sign in at: ${loginUrl}

Best regards,
Cura EMR Team`;
    
    return { subject, html, text };
  }

  async sendPasswordResetConfirmationEmail(toEmail: string, userFirstName: string): Promise<boolean> {
    const template = this.generatePasswordResetConfirmationEmail(userFirstName);
    return this.sendEmail({
      to: toEmail,
      subject: template.subject,
      html: template.html,
      text: template.text
    });
  }
}

export const emailService = new EmailService();