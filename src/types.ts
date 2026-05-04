export type Status =
  | 'To contact'
  | 'Walk-in planned'
  | 'Emailed'
  | 'Replied'
  | 'Scheduling'
  | 'Scheduled'
  | 'Met'
  | 'No-go';

export type Fit = 'HIGH' | 'MED' | 'LOW';

export type Owner = 'Me' | 'Collaborator' | 'Unassigned';

export type Department =
  | 'CEE'
  | 'EEPS'
  | 'ChBE'
  | 'Chemistry'
  | 'MechE'
  | 'CS'
  | 'Anthropology'
  | 'SESP'
  | 'Kellogg'
  | 'Pritzker Law'
  | 'Trienens/ISEN'
  | 'NU Water'
  | 'NAISE/Argonne'
  | 'Other';

export type Angle =
  | 'Sensor design'
  | 'Remote sensing/satellite'
  | 'Sensor networks'
  | 'Water policy/NGO'
  | 'Hydrology/rivers'
  | 'Water quality/contaminants'
  | 'Dev bank/global'
  | 'Restoration'
  | 'Utilities'
  | 'Commercialization'
  | 'ML/data';

export interface Paper {
  title: string;
  venue: string;
  year: number;
  url?: string;
}

export interface Contact {
  id: string;
  name: string;
  title: string;
  department: Department;
  email?: string;
  emailVerified?: boolean;
  phone?: string;
  officeLocation?: string;
  officeHours?: string;
  fit: Fit;
  angles: Angle[];
  whyFit: string;
  papers?: Paper[];
  opener?: string;
  talkingPoints?: string[];
  updates?: UpdateEntry[];
  notes?: string;
  source?: string;
  alreadyContacted?: boolean;
  meeting?: Meeting;
  status: Status;
  owner: Owner;
  lastTouch?: string;
  walkInTimeBlock?: 'morning' | 'afternoon-A' | 'afternoon-F' | 'late';
  walkInDay?: 0 | 1 | 2 | 3 | 4 | 5 | 6;
  thread?: EmailThread;
}

export type UpdateKind =
  | 'walk-in'
  | 'email'
  | 'email-draft'
  | 'reply'
  | 'meeting'
  | 'note'
  | 'system';

export interface EmailDraft {
  subject: string;
  body: string;
}

export interface EmailThread {
  threadId: string;
  messageIdHeader?: string;
  subject: string;
  lastChecked?: string;
  lastReplyAt?: string;
  replyClassification?: ReplyClassification;
}

export type ReplyIntent = 'yes' | 'no' | 'reschedule' | 'redirect' | 'info' | 'unclear';

export interface ReplyClassification {
  intent: ReplyIntent;
  summary: string;
  suggestedAction: string;
  proposedTimes?: string[];
}

export interface Settings {
  apiKey: string;
  model: string;
  userName: string;
  userSignature: string;
  voiceSamples: string;
  fromEmail: string;
  googleClientId: string;
  googleAccessToken?: string;
  googleAccessTokenExpiry?: number;
  googleEmail?: string;
  meetDurationMinutes?: number;
  meetTimezone?: string;
}

export interface UpdateEntry {
  id: string;
  timestamp: string;
  kind: UpdateKind;
  text: string;
}

export interface Meeting {
  date: string;
  start: string;
  end: string;
  link?: string;
  notes?: string;
}

export interface ContactPatch {
  status?: Status;
  owner?: Owner;
  notes?: string;
  lastTouch?: string;
  meeting?: Meeting | null;
  updates?: UpdateEntry[];
  thread?: EmailThread | null;
}
