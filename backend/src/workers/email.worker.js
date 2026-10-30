import dotenv from "dotenv";
dotenv.config({ path: "./.env" });

import { Worker } from "bullmq";
import { Resend } from "resend";
import { redisConnection } from "../queues/email.queue.js";

const resend = new Resend(process.env.RESEND_API_KEY);

console.log("📧 Lok Setu Email Worker running...");

// Helper to build email content based on job type
const buildEmailContent = (type, data) => {
    // Verification OTP: Sent on registration
    if (type === "verification_otp") {
        return {
            subject: "Verify your Lok Setu Account",
            html: `
                <div style="font-family:Arial,sans-serif;max-width:500px;margin:auto;padding:30px;border:1px solid #e5e7eb;border-radius:12px;color:#1f2937;">
                    <h2 style="color:#2563eb;margin-bottom:8px;">🏛️ Welcome to Lok Setu</h2>
                    <p style="color:#6b7280;margin-bottom:24px;">Apna account verify karne ke liye neeche diya gaya OTP darj karein:</p>
                    <div style="background:#eff6ff;padding:20px;border-radius:8px;text-align:center;font-size:32px;font-weight:bold;letter-spacing:8px;color:#1d4ed8;">
                        ${data.otp}
                    </div>
                    <p style="color:#9ca3af;font-size:13px;margin-top:20px;">
                        ⏳ Yeh OTP sirf <strong>10 minute</strong> tak valid hai.<br/>
                        Agar aapne yeh request nahi ki toh is email ko ignore karein.
                    </p>
                </div>
            `,
        };
    }

    // Forgot Password OTP
    if (type === "forgot_password_otp") {
        return {
            subject: "Reset Your Lok Setu Password",
            html: `
                <div style="font-family:Arial,sans-serif;max-width:500px;margin:auto;padding:30px;border:1px solid #e5e7eb;border-radius:12px;color:#1f2937;">
                    <h2 style="color:#dc2626;margin-bottom:8px;">🔒 Password Reset Request</h2>
                    <p style="color:#6b7280;margin-bottom:24px;">Apna password reset karne ke liye neeche diya OTP use karein:</p>
                    <div style="background:#fef2f2;padding:20px;border-radius:8px;text-align:center;font-size:32px;font-weight:bold;letter-spacing:8px;color:#b91c1c;">
                        ${data.otp}
                    </div>
                    <p style="color:#9ca3af;font-size:13px;margin-top:20px;">
                        ⏳ Yeh OTP sirf <strong>10 minute</strong> tak valid hai.<br/>
                        Agar aapne request nahi ki toh apna account secure rakhein aur password change karein.
                    </p>
                </div>
            `,
        };
    }

    // New policy / scheme alert notification
    if (type === "policy_alert") {
        return {
            subject: `📢 New Government Update: ${data.title}`,
            html: `
                <div style="font-family:Arial,sans-serif;max-width:500px;margin:auto;padding:30px;border:1px solid #e5e7eb;border-radius:12px;color:#1f2937;">
                    <h2 style="color:#16a34a;margin-bottom:8px;">🏛️ New Policy Alert</h2>
                    <p style="color:#6b7280;">Aapke region mein ek nayi sarkari yojana / notification aayi hai:</p>
                    <h3 style="color:#1f2937;margin:16px 0 8px;">${data.title}</h3>
                    <p style="color:#374151;margin-bottom:8px;"><strong>Issuing Authority:</strong> ${data.authority}</p>
                    <p style="color:#4b5563;margin-bottom:20px;">${data.summary}</p>
                    ${
                        data.portalUrl
                            ? `<a href="${data.portalUrl}" style="background:#2563eb;color:white;padding:12px 20px;text-decoration:none;border-radius:8px;display:inline-block;font-weight:bold;">
                        View Full Scheme Details →
                    </a>`
                            : ""
                    }
                    <p style="color:#9ca3af;font-size:12px;margin-top:24px;">
                        Yeh notification Lok Setu dwara aapki profile preferences ke aadhaar par bheji gayi hai.
                    </p>
                </div>
            `,
        };
    }

    // Fallback generic email
    return {
        subject: "Lok Setu Notification",
        html: `<p>${data.message || "Aapke liye ek notification hai."}</p>`,
    };
};

export const emailWorker = new Worker(
    "emailQueue",
    async (job) => {
        const { email, type, data } = job.data;

        if (!email) {
            console.error("❌ [EmailWorker] Missing recipient email:", job.data);
            return;
        }

        const { subject, html } = buildEmailContent(type, data);

        const { error } = await resend.emails.send({
            from: process.env.RESEND_FROM_EMAIL || "Lok Setu <onboarding@resend.dev>",
            to: email,
            subject,
            html,
        });

        if (error) {
            console.error(`❌ [EmailWorker] Resend API error for ${type}:`, error);
            throw new Error(error.message); // BullMQ will retry this job
        }

        console.log(`✅ [EmailWorker] Sent '${type}' email to ${email}`);
    },
    { connection: redisConnection }
);

emailWorker.on("failed", (job, err) => {
    console.error(`❌ [EmailWorker] Job ${job?.id} (${job?.data?.type}) failed: ${err?.message}`);
});

