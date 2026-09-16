export const otpTemplate = (
  otp: string,
  purpose: "LOGIN" | "FORGOT_PASSWORD",
) => {
  const title =
    purpose === "LOGIN" ? "Login Verification" : "Password Reset Verification";

  const description =
    purpose === "LOGIN"
      ? "Use the verification code below to securely sign in to your Promise Jewels administrator account."
      : "We received a request to reset your Promise Jewels administrator account password. Use the verification code below to continue.";

  return `
<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8" />
<title>${title}</title>
</head>

<body style="
margin:0;
padding:0;
background:#F6F1E7;
font-family:Arial,Helvetica,sans-serif;
">

<table width="100%" cellpadding="0" cellspacing="0">
<tr>
<td align="center" style="padding:40px 20px;">

<table
width="600"
cellpadding="0"
cellspacing="0"
style="
background:#ffffff;
border-radius:12px;
overflow:hidden;
box-shadow:0 10px 25px rgba(0,0,0,.08);
">

<tr>
<td
style="
background:#01484C;
padding:28px;
text-align:center;
color:white;
">

<h1 style="margin:0;font-size:28px;">
Promise Jewels
</h1>

<p style="
margin-top:10px;
color:#D3B380;
font-size:15px;
">
Luxury Jewellery Administration
</p>

</td>
</tr>

<tr>
<td style="padding:40px;">

<h2
style="
margin-top:0;
color:#01484C;
">
${title}
</h2>

<p
style="
font-size:16px;
line-height:1.7;
color:#555;
">
${description}
</p>

<div
style="
margin:35px 0;
text-align:center;
">

<div
style="
display:inline-block;
padding:18px 40px;
font-size:34px;
font-weight:bold;
letter-spacing:8px;
background:#F6F1E7;
border:2px dashed #B69760;
border-radius:10px;
color:#01484C;
">
${otp}
</div>

</div>

<p
style="
color:#555;
line-height:1.7;
">
This verification code will expire in
<strong>5 minutes</strong>.
</p>

<p
style="
color:#777;
line-height:1.7;
">
If you did not request this action,
you can safely ignore this email.
Your account will remain secure.
</p>

</td>
</tr>

<tr>
<td
style="
background:#01484C;
padding:24px;
text-align:center;
font-size:13px;
color:#D3B380;
">

© ${new Date().getFullYear()} Promise Jewels

<br><br>

This is an automated email.
Please do not reply.

</td>
</tr>

</table>

</td>
</tr>
</table>

</body>
</html>
`;
};
