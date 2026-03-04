export const Q1_OPTIONS = [
  'With confidence and absolutely no evidence',
  'Reluctantly but loudly',
  'I take things seriously until they become inconvenient',
  'I am technically present',
  'I prefer to delegate blame'
] as const;

export const Q2_OPTIONS = [
  'Take charge immediately',
  'Suggest the meeting',
  "Pretend it's not happening",
  'Make it worse but with confidence',
  'Quietly disappear'
] as const;

export const Q3_OPTIONS = ['Adam', 'Kyle', 'I can never choose'] as const;

export const EXIT_Q1_LABEL =
  'Exit Question 1: What is the primary administrative reason for your resignation?' as const;

export const EXIT_Q1_OPTIONS = [
  'Form 27-B (Intent to Continue Existing) was denied by Procurement',
  'My role was reclassified as non-essential glitter handling',
  'I can no longer afford the mandatory clown commute permit'
] as const;

export const EXIT_Q2_LABEL =
  'Exit Question 2: Which compliance event most influenced this decision?' as const;

export const EXIT_Q2_OPTIONS = [
  'A 14-signature approval chain stalled my tea break indefinitely',
  'I was issued conflicting SOPs by two equally confident departments',
  'The Bureau of Reasonable Hats opened a formal inquiry into my posture'
] as const;

export const EXIT_Q3_LABEL =
  'Exit Question 3: How would you like your departure logged in the official archive?' as const;

export const EXIT_Q3_OPTIONS = [
  'As a strategic redeployment to off-site nonsense operations',
  'As voluntary retirement pending appeal, countersigned by Finance',
  'As a temporary pause while Legal reviews the lion-related clauses'
] as const;

export const STATUS = {
  AVAILABLE: 'AVAILABLE',
  FILLED: 'FILLED',
  REHIRING: 'REHIRING'
} as const;

export const DEFAULT_REHIRING_REASONS = [
  'The previous post-holder filed all trapeze flight-path risk assessments in haiku. While beautiful, they were deemed non-compliant and legally un-actionable.',
  'The previous post-holder double-booked two poltergeists into Tent 3 at 19:00. The resulting territorial haunting required a full exorcism and a calendar migration.',
  'The previous post-holder issued a clown apology that failed the Honk-Sincerity Audit (Form C-12) due to "insufficient remorse" and "aggressive honking."',
  'The previous post-holder applied industrial-grade cannon grease without a valid Slip Permit, creating a mobile morale hazard that moved faster than accountability.',
  'The previous post-holder allowed a zebra to remain unregistered for three reporting cycles. The zebra remains at large and refuses to complete onboarding.',
  'The previous post-holder introduced a "freeform queue" policy. This triggered civil unrest, spontaneous chanting, and a surprisingly organised coup.',
  'The previous post-holder stamped "APPROVED" on documents later determined to be "CATASTROPHIC." The stamp has been placed on administrative leave.',
  'The previous post-holder relocated Tent 4B two metres to the left without filing Form S-4 (Spatial Intent Declaration). Several departments are now technically in France.',
  'The previous post-holder failed to submit the required quarterly compliments to the safety net, resulting in demotivation, underperformance, and one passive-aggressive sag.',
  'The previous post-holder demonstrated confidence levels beyond policy limits, causing applause-related overconfidence in three departments and one volunteer.',
  'The previous post-holder conducted a performance review with a tiger and recorded the outcome as "constructive, but final." HR cannot locate the paperwork or the reviewer.',
  'The previous post-holder classified all unidentified liquids as "probably water," in direct violation of Liquid Protocol M-9. It was not water.',
  'The previous post-holder submitted timesheets dated "next Thursday," triggering a payroll loop and mild existential dread within Finance.',
  'The previous post-holder authorised fog machine output at "legally meaningful density," triggering an evacuation and the accidental summoning of Nigel (again).',
  'The previous post-holder approved 37 occupants in a clown car rated for 12, citing "team-building" and "spatial optimism." Insurance has blocked our number.',
  'The previous post-holder failed to obtain spirit signatures on the attendance sheet, logging them instead as "vibes present." Legal has requested fewer vibes and more ink.',
  'The previous post-holder opened the Glitter Incident Drawer without PPE, spreading sparkle contamination across HR records, the break room, and at least one soul.',
  'The previous post-holder initiated unicycle peace talks without a Wobble Permissions Certificate (Form U-3), resulting in a rolling strike and one minor wheel-based tribunal.'
] as const;
