# Supabase Email Templates

Brand-consistent HTML email templates for all Essential Space authentication flows.
These files use **inline CSS only**, table-based layouts, and the Supabase Go-template
variable `{{ .ConfirmationURL }}` — ready to paste directly into the Supabase dashboard.

---

## Template Map

| File | Supabase Dashboard Template | Subject Line to Paste |
|---|---|---|
| `confirmation.html` | **Confirm signup** | `Confirm your email to finish setting up Essential Space` |
| `recovery.html` | **Reset password** | `Reset your Essential Space password` |
| `magic_link.html` | **Magic Link** | `Your Essential Space login link` |
| `email_change.html` | **Change Email Address** | `Confirm your new email for Essential Space` |

---

## How to Apply in the Supabase Dashboard

1. Open [https://supabase.com/dashboard](https://supabase.com/dashboard) and select your project.
2. Navigate to **Authentication → Email Templates**.
3. For each template listed above:
   - Select the matching template tab (e.g. "Confirm signup").
   - Paste the **Subject Line** from the table above into the Subject field.
   - Open the corresponding `.html` file, copy its **full contents**, and paste into the **Message body** (HTML) field.
   - Click **Save**.

> Supabase will automatically replace `{{ .ConfirmationURL }}` with the real
> one-time link at send time. Do not replace it manually.

---

## Design Reference

| Token | Value |
|---|---|
| Outer background | `#f4f4f5` |
| Card background | `#ffffff` |
| Card border | `2px solid #111111` |
| Header bar | `#111111` |
| Wordmark | `✦ ESSENTIAL SPACE` (text — no image) |
| Accent / CTA color | `#FF5A36` |
| Button shadow | `3px 3px 0 #111111` |
| Heading color | `#111111`, 24 px, weight 800 |
| Body text | `#3f3f46`, 15 px, line-height 1.6 |
| Font stack | `'Helvetica Neue', Helvetica, Arial, sans-serif` |

---

## Deliverability Checklist

- [x] Inline CSS only — no `<style>` blocks, no external stylesheets
- [x] Table-based layout with `role="presentation"` on all structural tables
- [x] No SVG, no JavaScript, no background images
- [x] Text wordmark — no logo image dependencies
- [x] Plaintext fallback link below every button
- [x] Non-spammy subject lines and copy (no "FREE", "ACT NOW", excessive caps)
- [x] `{{ .ConfirmationURL }}` used for every button href and fallback
- [x] Valid `<!DOCTYPE html>`, `<html lang="en">`, charset meta, viewport meta
- [x] Subject line in HTML comment at top of each file
- [x] Footer explaining why the email was sent + ignore instruction
