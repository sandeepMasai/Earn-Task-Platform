// Resend REST API; API keys and reset codes never leave the backend except by email.
function assertConfigured() {
  if (!process.env.RESEND_API_KEY?.trim() || !process.env.PASSWORD_RESET_FROM?.trim()) {
    throw Object.assign(new Error('Password reset is temporarily unavailable'), { status: 503 });
  }
}
async function sendResetCode(email, code) {
  assertConfigured();
  try {
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from: process.env.PASSWORD_RESET_FROM,
        to: [email],
        subject: 'Reset your Earn Task password',
        text: `Your password reset code is ${code}. It expires in 10 minutes. If you did not request this, ignore this email. Never share this code.`,
      }),
      signal: AbortSignal.timeout(10000),
      redirect: 'error',
    });
    if (!response.ok) throw new Error('Delivery rejected');
    await response.body?.cancel();
  } catch {
    // Never propagate provider response bodies, headers, or network error details.
    throw new Error('Password reset email delivery failed');
  }
}
module.exports = { assertConfigured, sendResetCode };
