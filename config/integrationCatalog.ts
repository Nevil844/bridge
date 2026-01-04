// Central catalog for integration display metadata (name + logo).
// Keep in sync with the integrations list in app/(tabs)/integrations.tsx.

export interface IntegrationDisplay {
  type: string;
  name: string;
  logo?: string;
}

const ENTRIES: IntegrationDisplay[] = [
  {
    type: 'github',
    name: 'GitHub',
    logo: 'https://github.githubassets.com/images/modules/logos_page/GitHub-Mark.png',
  },
  {
    type: 'google-drive',
    name: 'Google Drive',
    logo: 'https://upload.wikimedia.org/wikipedia/commons/thumb/d/da/Google_Drive_logo.png/240px-Google_Drive_logo.png',
  },
  {
    type: 'gmail',
    name: 'Gmail',
    logo: 'https://www.gstatic.com/images/branding/product/1x/gmail_2020q4_48dp.png',
  },
  {
    type: 'google-calendar',
    name: 'Google Calendar',
    logo: 'https://upload.wikimedia.org/wikipedia/commons/thumb/a/a5/Google_Calendar_icon_%282020%29.svg/512px-Google_Calendar_icon_%282020%29.svg.png?20221106121915',
  },
  {
    type: 'zerodha',
    name: 'Zerodha',
    logo: 'https://upload.wikimedia.org/wikipedia/commons/thumb/9/9d/Zerodha_logo.svg/150px-Zerodha_logo.svg.png',
  },
  {
    type: 'spotify',
    name: 'Spotify',
    logo: 'https://storage.googleapis.com/pr-newsroom-wp/1/2023/05/Spotify_Primary_Logo_RGB_Green.png',
  },
  {
    type: 'slack',
    name: 'Slack',
    logo: 'https://a.slack-edge.com/80588/marketing/img/icons/icon_slack_hash_colored.png',
  },
  {
    type: 'youtube',
    name: 'YouTube',
    logo: 'https://upload.wikimedia.org/wikipedia/commons/thumb/0/09/YouTube_full-color_icon_%282017%29.svg/150px-YouTube_full-color_icon_%282017%29.svg.png',
  },
  {
    type: 'x',
    name: 'X (Twitter)',
    logo: 'https://upload.wikimedia.org/wikipedia/commons/thumb/b/b7/X_logo.jpg/1200px-X_logo.jpg',
  },
  // Upcoming / secondary
  { type: 'jira', name: 'Jira', logo: 'https://upload.wikimedia.org/wikipedia/commons/thumb/8/8a/Jira_Logo.svg/150px-Jira_Logo.svg.png' },
  { type: 'zomato', name: 'Zomato', logo: 'https://logo.clearbit.com/zomato.com' },
  { type: 'whatsapp', name: 'WhatsApp', logo: 'https://upload.wikimedia.org/wikipedia/commons/thumb/6/6b/WhatsApp.svg/150px-WhatsApp.svg.png' },
  { type: 'aws', name: 'AWS', logo: 'https://upload.wikimedia.org/wikipedia/commons/thumb/9/93/Amazon_Web_Services_Logo.svg/300px-Amazon_Web_Services_Logo.svg.png' },
  { type: 'discord', name: 'Discord', logo: 'https://cdn-icons-png.flaticon.com/512/5968/5968756.png' },
  { type: 'instagram', name: 'Instagram', logo: 'https://upload.wikimedia.org/wikipedia/commons/thumb/e/e7/Instagram_logo_2016.svg/150px-Instagram_logo_2016.svg.png' },
  { type: 'telegram', name: 'Telegram', logo: 'https://upload.wikimedia.org/wikipedia/commons/thumb/8/82/Telegram_logo.svg/150px-Telegram_logo.svg.png' },
  { type: 'reddit', name: 'Reddit', logo: 'https://www.redditstatic.com/desktop2x/img/favicon/android-icon-192x192.png' },
  { type: 'pinterest', name: 'Pinterest', logo: 'https://upload.wikimedia.org/wikipedia/commons/thumb/0/08/Pinterest-logo.png/150px-Pinterest-logo.png' },
  { type: 'notion', name: 'Notion', logo: 'https://www.notion.so/images/logo-ios.png' },
  { type: 'teams', name: 'Microsoft Teams', logo: 'https://upload.wikimedia.org/wikipedia/commons/thumb/c/c9/Microsoft_Office_Teams_%282018%E2%80%93present%29.svg/150px-Microsoft_Office_Teams_%282018%E2%80%93present%29.svg.png' },
  { type: 'salesforce', name: 'Salesforce', logo: 'https://upload.wikimedia.org/wikipedia/commons/thumb/f/f9/Salesforce.com_logo.svg/150px-Salesforce.com_logo.svg.png' },
  { type: 'swiggy', name: 'Swiggy', logo: 'https://logo.clearbit.com/swiggy.com' },
  { type: 'uber', name: 'Uber', logo: 'https://upload.wikimedia.org/wikipedia/commons/thumb/c/cc/Uber_logo_2018.png/150px-Uber_logo_2018.png' },
  { type: 'ola', name: 'Ola', logo: 'https://logo.clearbit.com/olacabs.com' },
  { type: 'zepto', name: 'Zepto', logo: 'https://logo.clearbit.com/zeptonow.com' },
  { type: 'blinkit', name: 'Blinkit', logo: 'https://upload.wikimedia.org/wikipedia/commons/thumb/2/2f/Blinkit-yellow-app-icon.svg/150px-Blinkit-yellow-app-icon.svg.png' },
  { type: 'linkedin', name: 'LinkedIn', logo: 'https://upload.wikimedia.org/wikipedia/commons/thumb/c/ca/LinkedIn_logo_initials.png/150px-LinkedIn_logo_initials.png' },
];

const MAP: Record<string, IntegrationDisplay> = ENTRIES.reduce((acc, entry) => {
  acc[entry.type] = entry;
  return acc;
}, {} as Record<string, IntegrationDisplay>);

export function getIntegrationDisplay(type?: string | null): IntegrationDisplay | null {
  if (!type) return null;
  return MAP[type] ?? null;
}

