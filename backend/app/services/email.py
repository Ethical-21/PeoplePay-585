import smtplib
import os
from email.message import EmailMessage
from dotenv import load_dotenv
from pydantic import EmailStr

load_dotenv()

# We look for these in .env (if not present, we can just print to console for mock)
SMTP_SERVER = os.getenv("SMTP_SERVER", "smtp.gmail.com")
SMTP_PORT = int(os.getenv("SMTP_PORT", 587))
SMTP_USERNAME = os.getenv("SMTP_USERNAME", "")
SMTP_PASSWORD = os.getenv("SMTP_PASSWORD", "")
SMTP_FROM_EMAIL = os.getenv("SMTP_FROM_EMAIL", SMTP_USERNAME or "noreply@company.com")

def send_welcome_email(to_email: str, full_name: str, temp_password: str):
    """
    Sends a welcome email to the newly created user with their credentials.
    If SMTP details are missing from .env, it defaults to printing to the console (mock mode).
    """
    subject = "Welcome to the Company - Your Account Credentials"
    
    # We create an HTML body for a nicer look
    html_content = f"""
    <html>
    <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
        <h2>Welcome to the Company, {full_name}!</h2>
        <p>Your user account has been successfully created by the administrator.</p>
        <p>Here are your temporary login credentials. Please log in and change your password as soon as possible.</p>
        
        <div style="background-color: #f4f4f4; padding: 15px; border-radius: 5px; margin: 20px 0;">
            <p style="margin: 0;"><strong>Email / Username:</strong> {to_email}</p>
            <p style="margin: 0;"><strong>Temporary Password:</strong> {temp_password}</p>
        </div>
        
        <p>Best regards,<br>The HR & IT Team</p>
    </body>
    </html>
    """

    # For hackathon/demo purposes, if SMTP is not configured, just print it out.
    if not SMTP_USERNAME or not SMTP_PASSWORD:
        print("="*60)
        print("MOCK EMAIL SERVICE TRIGGERED (No SMTP credentials found in .env)")
        print(f"TO: {to_email}")
        print(f"SUBJECT: {subject}")
        print(f"CONTENT:\n{html_content}")
        print("="*60)
        return True

    msg = EmailMessage()
    msg['Subject'] = subject
    msg['From'] = SMTP_FROM_EMAIL
    msg['To'] = to_email
    msg.set_content(f"Welcome {full_name}!\nYour temp password is: {temp_password}")
    msg.add_alternative(html_content, subtype='html')

    try:
        with smtplib.SMTP(SMTP_SERVER, SMTP_PORT) as server:
            server.starttls()
            server.login(SMTP_USERNAME, SMTP_PASSWORD)
            server.send_message(msg)
        print(f"[EMAIL] Successfully sent welcome email to {to_email}")
        return True
    except Exception as e:
        print(f"[EMAIL ERROR] Failed to send email to {to_email}: {str(e)}")
        # We don't want to crash the request if email fails, just log it.
        return False
