// Email clients strip most CSS and ignore flexbox/grid, so layout is table-based
// with inline styles. The <style> block only adds progressive enhancements
// (dark mode, mobile padding) for clients that support it.

// Mirrors frontend-web/src/styles/token.css. Alpha tokens are flattened to solid
// hex because Outlook does not support transparent colors.
const theme = {
  page: '#f6f8fb',
  surface: '#ffffff',
  well: '#eef2f8',
  border: '#e3e8f0',
  textPrimary: '#0d1b36',
  textSecondary: '#3d4f6e',
  textTertiary: '#6b7a99',
  actionPrimary: '#0d1b36',
  accent: '#0ea592',
  accentForeground: '#ffffff',
  infoBackground: '#eff6ff',
  infoBorder: '#bfdbfe',
  infoText: '#1e40af',
  radius: '12px',
  radiusSm: '8px',
  font: "Inter, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif",
  monoFont: "'SFMono-Regular', Menlo, Consolas, 'Liberation Mono', monospace",
} as const;

const darkThemeStyles = `
  :root { color-scheme: light dark; supported-color-schemes: light dark; }
  @media (prefers-color-scheme: dark) {
    .gx-page { background-color: #0c1424 !important; }
    .gx-card { background-color: #152035 !important; border-color: #22324d !important; border-top-color: #0ea592 !important; }
    .gx-well { background-color: #1c2e48 !important; border-color: #22324d !important; }
    .gx-logo-mark { background-color: #0ea592 !important; }
    .gx-text-primary { color: #e2eaf4 !important; }
    .gx-text-secondary { color: #a8bdd4 !important; }
    .gx-text-tertiary { color: #7a90a8 !important; }
    .gx-divider { border-color: #22324d !important; }
    .gx-callout { background-color: #172a4a !important; border-color: #2a4a7a !important; }
    .gx-callout-text { color: #93c5fd !important; }
  }
  @media only screen and (max-width: 600px) {
    .gx-card-body { padding: 28px 20px !important; }
    .gx-code { font-size: 28px !important; letter-spacing: 6px !important; }
  }
`;

export const escapeHtml = (value: string): string =>
  value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');

export const paragraph = (html: string): string =>
  `<p class="gx-text-secondary" style="margin: 0 0 16px; font-family: ${theme.font}; font-size: 15px; line-height: 24px; color: ${theme.textSecondary};">${html}</p>`;

export const strong = (text: string): string =>
  `<strong class="gx-text-primary" style="color: ${theme.textPrimary}; font-weight: 600;">${escapeHtml(text)}</strong>`;

export const codeBlock = (code: string): string => `
  <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="margin: 8px 0 24px;">
    <tr>
      <td class="gx-well" align="center" style="padding: 24px 16px; background-color: ${theme.well}; border: 1px solid ${theme.border}; border-radius: ${theme.radius};">
        <div class="gx-text-tertiary" style="margin: 0 0 8px; font-family: ${theme.font}; font-size: 12px; font-weight: 600; letter-spacing: 1px; text-transform: uppercase; color: ${theme.textTertiary};">Verification code</div>
        <div class="gx-code gx-text-primary" style="font-family: ${theme.monoFont}; font-size: 34px; line-height: 40px; font-weight: 700; letter-spacing: 10px; color: ${theme.textPrimary};">${escapeHtml(code)}</div>
      </td>
    </tr>
  </table>`;

// Bulletproof button: the background lives on the <td> so it still renders in
// Outlook, which ignores padding and background on <a>.
export const button = (label: string, url: string): string => `
  <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin: 8px 0 24px;">
    <tr>
      <td align="center" bgcolor="${theme.accent}" style="border-radius: ${theme.radiusSm}; background-color: ${theme.accent};">
        <a href="${escapeHtml(url)}" target="_blank" rel="noopener" style="display: inline-block; padding: 13px 28px; font-family: ${theme.font}; font-size: 15px; line-height: 20px; font-weight: 600; color: ${theme.accentForeground}; text-decoration: none; border-radius: ${theme.radiusSm};">${escapeHtml(label)}</a>
      </td>
    </tr>
  </table>`;

export const callout = (html: string): string => `
  <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="margin: 0 0 24px;">
    <tr>
      <td class="gx-callout" style="padding: 12px 16px; background-color: ${theme.infoBackground}; border: 1px solid ${theme.infoBorder}; border-radius: ${theme.radiusSm};">
        <p class="gx-callout-text" style="margin: 0; font-family: ${theme.font}; font-size: 13px; line-height: 20px; color: ${theme.infoText};">${html}</p>
      </td>
    </tr>
  </table>`;

export const fallbackLink = (url: string): string => `
  <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">
    <tr>
      <td class="gx-divider" style="padding: 20px 0 0; border-top: 1px solid ${theme.border};">
        <p class="gx-text-tertiary" style="margin: 0 0 6px; font-family: ${theme.font}; font-size: 13px; line-height: 20px; color: ${theme.textTertiary};">Button not working? Copy and paste this link into your browser:</p>
        <a href="${escapeHtml(url)}" target="_blank" rel="noopener" style="font-family: ${theme.font}; font-size: 13px; line-height: 20px; color: ${theme.accent}; word-break: break-all;">${escapeHtml(url)}</a>
      </td>
    </tr>
  </table>`;

interface LayoutInput {
  // Inbox preview line shown next to the subject.
  preheader: string;
  heading: string;
  bodyHtml: string;
  // Explains why the recipient got this email.
  footerNote: string;
}

export const renderLayout = (input: LayoutInput): string => `<!DOCTYPE html>
<html lang="en" xmlns="http://www.w3.org/1999/xhtml">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <meta name="x-apple-disable-message-reformatting" />
    <meta name="color-scheme" content="light dark" />
    <meta name="supported-color-schemes" content="light dark" />
    <title>${escapeHtml(input.heading)}</title>
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700&display=swap" rel="stylesheet" />
    <style>${darkThemeStyles}</style>
  </head>
  <body class="gx-page" style="margin: 0; padding: 0; width: 100%; background-color: ${theme.page}; -webkit-font-smoothing: antialiased;">
    <div style="display: none; max-height: 0; max-width: 0; overflow: hidden; opacity: 0; mso-hide: all;">${escapeHtml(input.preheader)}&#8199;&#847;&#8199;&#847;&#8199;&#847;&#8199;&#847;&#8199;&#847;&#8199;&#847;</div>
    <table class="gx-page" role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background-color: ${theme.page};">
      <tr>
        <td align="center" style="padding: 40px 16px;">
          <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="max-width: 560px;">
            <tr>
              <td style="padding: 0 4px 24px;">
                <table role="presentation" cellpadding="0" cellspacing="0" border="0">
                  <tr>
                    <td class="gx-logo-mark" width="32" height="32" align="center" valign="middle" style="width: 32px; height: 32px; background-color: ${theme.actionPrimary}; border-radius: ${theme.radiusSm}; font-family: ${theme.font}; font-size: 16px; line-height: 32px; color: #ffffff;">&#9889;&#xFE0E;</td>
                    <td class="gx-text-primary" style="padding-left: 10px; font-family: ${theme.font}; font-size: 18px; font-weight: 700; color: ${theme.textPrimary};">GridX</td>
                  </tr>
                </table>
              </td>
            </tr>
            <tr>
              <td class="gx-card" style="background-color: ${theme.surface}; border: 1px solid ${theme.border}; border-top: 4px solid ${theme.accent}; border-radius: ${theme.radius};">
                <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">
                  <tr>
                    <td class="gx-card-body" style="padding: 36px 40px;">
                      <h1 class="gx-text-primary" style="margin: 0 0 16px; font-family: ${theme.font}; font-size: 24px; line-height: 32px; font-weight: 700; letter-spacing: -0.3px; color: ${theme.textPrimary};">${escapeHtml(input.heading)}</h1>
                      ${input.bodyHtml}
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
            <tr>
              <td align="center" style="padding: 28px 16px 0;">
                <p class="gx-text-tertiary" style="margin: 0 0 8px; font-family: ${theme.font}; font-size: 12px; line-height: 18px; color: ${theme.textTertiary};">${escapeHtml(input.footerNote)}</p>
                <p class="gx-text-tertiary" style="margin: 0; font-family: ${theme.font}; font-size: 12px; line-height: 18px; color: ${theme.textTertiary};">&copy; ${new Date().getFullYear()} GridX &middot; Peer-to-peer energy trading</p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;

export const renderText = (lines: string[]): string =>
  [...lines, '', '—', `© ${new Date().getFullYear()} GridX · Peer-to-peer energy trading`].join(
    '\n',
  );
