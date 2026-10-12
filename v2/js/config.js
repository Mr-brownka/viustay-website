// ============================================================
// Viustay site settings. This is the ONLY file you need to edit
// to connect the site. See README.md for where each value comes from.
// ============================================================
window.VIUSTAY_CONFIG = {
  // Supabase: Project Settings -> API. Leave empty to run in demo mode
  // (forms work but nothing is saved).
  SUPABASE_URL: 'https://yjvjakhxfhrsmixsfpzl.supabase.co',
  SUPABASE_ANON_KEY: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inlqdmpha2h4Zmhyc21peHNmcHpsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTE0NjYxMTQsImV4cCI6MjEwNzA0MjExNH0.2MsEePC1tiY2tB5eLaRTKNVD775fuqdHDdbRAx7XaLc',

  // Google Sheet with your listings: File -> Share -> Publish to web ->
  // pick the listings tab -> "Comma-separated values (.csv)" -> copy link.
  // Leave empty to use the sample listings in data/sample-listings.csv.
  LISTINGS_CSV_URL: 'https://docs.google.com/spreadsheets/d/e/2PACX-1vT2ppDgVK30OMt7_XhonTkgVuYG_haSSHneQreyqAHvlTQa6rxa6QS8BF-aIe_JKbahcmYQlPFH_1Rk/pub?gid=796984091&single=true&output=csv',

  // Optional: a separate tab for short stays (publish that tab as CSV and paste the link).
  // Every row in it is treated as a short stay. Leave empty to keep short stays in the main tab.
  SHORT_STAYS_CSV_URL: 'https://docs.google.com/spreadsheets/d/e/2PACX-1vRZpKU2QyAmH0Ol-zEePPBtk3EJQ8d1gIPXiV9SvCm-7SHVmdMj_NuDjcsERvfovmmboE0oO5ku-3Ui/pub?output=tsv',

  // Home page intro: a photo (or an .mp4 video loop) of Nairobi behind "Let's find your family's next home".
  // Default photo: Nairobi skyline by Kenny Murgor on Unsplash (free licence).
  INTRO_IMAGE: 'https://images.unsplash.com/photo-1693902997450-7e912c0d3554?auto=format&fit=crop&w=1800&q=70',
  INTRO_VIDEO: '',

  // WhatsApp Business number, international format, digits only.
  WHATSAPP_NUMBER: '254748600342',

  // Fees: shown on the site. Leave as-is until the wording is final.
  VIEWING_FEE_TEXT: '[VIEWING FEE]',
  PLACEMENT_FEE_TEXT: '[PLACEMENT FEE]',
  CARETAKER_REWARD_TEXT: '[CARETAKER REWARD]'
};
