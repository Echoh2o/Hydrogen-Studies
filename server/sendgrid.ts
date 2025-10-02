import sgMail from "@sendgrid/mail";

// Check if SendGrid API key is set
if (!process.env.SENDGRID_API_KEY) {
  console.warn(
    "Warning: SENDGRID_API_KEY is not set. Email functionality will not work.",
  );
} else {
  sgMail.setApiKey(process.env.SENDGRID_API_KEY);
}

interface EmailData {
  name: string;
  email: string;
  subject: string;
  message: string;
}

/**
 * Send an email using SendGrid
 * @param emailData The contact form data
 * @returns Success status
 */
export async function sendContactEmail(emailData: EmailData): Promise<boolean> {
  if (!process.env.SENDGRID_API_KEY) {
    console.error("SENDGRID_API_KEY not set. Cannot send email.");
    return false;
  }

  try {
    const { name, email, subject, message } = emailData;

    const msg = {
      to: "support@hydrogenstudies.com",
      from: "no-reply@hydrogenstudies.com", // This must be a verified sender in your SendGrid account
      subject: `Contact Form: ${subject}`,
      text: `
        New message from the contact form:
        
        Name: ${name}
        Email: ${email}
        
        Message:
        ${message}
      `,
      html: `
        <h2>New message from the contact form</h2>
        <p><strong>Name:</strong> ${name}</p>
        <p><strong>Email:</strong> ${email}</p>
        <h3>Message:</h3>
        <p>${message.replace(/\n/g, "<br>")}</p>
      `,
      replyTo: email,
    };

    await sgMail.send(msg);
    console.log("Email sent successfully");
    return true;
  } catch (error) {
    console.error("Error sending email:", error);
    return false;
  }
}
