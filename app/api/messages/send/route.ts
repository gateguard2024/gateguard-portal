import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { createServiceClient } from "@/lib/supabase";

interface SendBody {
  thread_id: string;
  body: string;
  subject?: string;
  channel_id?: string;       // override channel; falls back to thread's channel
}

// POST /api/messages/send — send a message via the thread's channel
export async function POST(req: Request) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json() as SendBody;
  const { thread_id, body: msgBody, subject, channel_id: overrideChannelId } = body;

  if (!thread_id || !msgBody?.trim()) {
    return NextResponse.json({ error: "thread_id and body are required" }, { status: 400 });
  }

  const supabase = createServiceClient();

  // 1. Load thread + channel (ownership enforced by RLS)
  const { data: thread, error: threadErr } = await supabase
    .from("message_threads")
    .select("id, channel_id, participants, message_channels ( channel_type, config, oauth_access_token )")
    .eq("id", thread_id)
    .eq("user_id", userId)
    .single();

  if (threadErr || !thread) {
    return NextResponse.json({ error: "Thread not found" }, { status: 404 });
  }

  const effectiveChannelId = overrideChannelId ?? thread.channel_id;
  const channel = (thread.message_channels as unknown) as {
    channel_type: string;
    config: Record<string, unknown>;
    oauth_access_token?: string;
  } | null;

  if (!channel) {
    return NextResponse.json({ error: "Channel not configured" }, { status: 400 });
  }

  // 2. Record message as pending
  const { data: message, error: insertErr } = await supabase
    .from("messages")
    .insert({
      thread_id,
      channel_id:   effectiveChannelId,
      direction:    "outbound",
      source_type:  channel.channel_type,
      from_address: userId,
      from_name:    "You",
      to_addresses: thread.participants,
      subject:      subject ?? null,
      body:         msgBody,
      status:       "pending",
      sent_at:      new Date().toISOString(),
    })
    .select("id, body, status, created_at")
    .single();

  if (insertErr) return NextResponse.json({ error: insertErr.message }, { status: 500 });

  // 3. Route to the correct send implementation
  let sendResult: { success: boolean; error?: string } = { success: false };

  try {
    switch (channel.channel_type) {
      case "twilio":
        sendResult = await sendViaTwilio(msgBody, thread.participants as {address:string}[], channel.config);
        break;
      case "smtp":
        sendResult = await sendViaSMTP(msgBody, subject, thread.participants as {name?:string;address:string}[], channel.config);
        break;
      case "gmail":
        sendResult = await sendViaGmail(msgBody, subject, thread.participants as {name?:string;address:string}[], channel.oauth_access_token ?? "");
        break;
      case "internal":
        // Internal messages are delivered via the DB — already inserted above
        sendResult = { success: true };
        break;
      default:
        sendResult = { success: false, error: `Unsupported channel type: ${channel.channel_type}` };
    }
  } catch (e) {
    sendResult = { success: false, error: String(e) };
  }

  // 4. Update message status
  const finalStatus = sendResult.success ? "sent" : "failed";
  void (async () => {
    try {
      await supabase
        .from("messages")
        .update({
          status:        finalStatus,
          error_message: sendResult.error ?? null,
        })
        .eq("id", message!.id);
    } catch (_) {}
  })();

  if (!sendResult.success) {
    return NextResponse.json({ error: sendResult.error ?? "Send failed" }, { status: 500 });
  }

  return NextResponse.json({ message: { ...message, status: "sent" } }, { status: 201 });
}

// ─── Send implementations ─────────────────────────────────────────────────────

async function sendViaTwilio(
  body: string,
  participants: { address: string }[],
  config: Record<string, unknown>
): Promise<{ success: boolean; error?: string }> {
  const accountSid = process.env.TWILIO_ACCOUNT_SID ?? (config.account_sid as string);
  const authToken  = process.env.TWILIO_AUTH_TOKEN  ?? (config.auth_token as string);
  const from       = process.env.TWILIO_PHONE_NUMBER ?? (config.phone_number as string);

  if (!accountSid || !authToken || !from) {
    return { success: false, error: "Twilio credentials not configured" };
  }

  const to = participants[0]?.address;
  if (!to) return { success: false, error: "No recipient phone number" };

  const url  = `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`;
  const creds = Buffer.from(`${accountSid}:${authToken}`).toString("base64");

  const res = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Basic ${creds}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({ From: from, To: to, Body: body }).toString(),
  });

  if (!res.ok) {
    const err = await res.text();
    return { success: false, error: err };
  }
  return { success: true };
}

async function sendViaSMTP(
  body: string,
  subject: string | undefined,
  participants: { name?: string; address: string }[],
  config: Record<string, unknown>
): Promise<{ success: boolean; error?: string }> {
  // Use Resend if RESEND_API_KEY is available; otherwise note SMTP config pending
  const resendKey = process.env.RESEND_API_KEY;
  if (resendKey) {
    const to  = participants.map((p) => p.address);
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${resendKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from:    (config.from_address as string) ?? "GateGuard <noreply@gateguard.co>",
        to,
        subject: subject ?? "(no subject)",
        text:    body,
      }),
    });
    if (!res.ok) {
      const err = await res.text();
      return { success: false, error: err };
    }
    return { success: true };
  }

  // Direct SMTP via fetch is not possible server-side without nodemailer.
  // Mark as pending — SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS env vars
  // will be wired when Nodemailer is added.
  return { success: false, error: "SMTP send requires RESEND_API_KEY or Nodemailer setup" };
}

async function sendViaGmail(
  body: string,
  subject: string | undefined,
  participants: { name?: string; address: string }[],
  accessToken: string
): Promise<{ success: boolean; error?: string }> {
  if (!accessToken) return { success: false, error: "Gmail not connected — re-authorize" };

  const to      = participants.map((p) => p.address).join(", ");
  const subj    = subject ?? "(no subject)";
  const raw     = btoa(
    `To: ${to}\r\nSubject: ${subj}\r\nContent-Type: text/plain; charset=utf-8\r\n\r\n${body}`
  ).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");

  const res = await fetch("https://gmail.googleapis.com/gmail/v1/users/me/messages/send", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ raw }),
  });

  if (!res.ok) {
    const err = await res.text();
    return { success: false, error: err };
  }
  return { success: true };
}
