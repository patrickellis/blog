// Site-wide constants for TFT Personal Tutor.
// Keep product facts here so the landing page, privacy policy and terms
// always agree with each other (and with the Riot API application).

export const PRODUCT_NAME = 'TFT Personal Tutor';
export const SITE_TITLE = 'TFT Personal Tutor | Post-game coaching for Teamfight Tactics';
export const SITE_DESCRIPTION =
	'TFT Personal Tutor reviews your own ranked Teamfight Tactics match history and gives you a plain-language report on your strengths, recurring weaknesses and two or three focus points for your next session. Post-game only.';

export const SITE_URL = 'https://patrickellis.dev';
export const CONTACT_EMAIL = 'patrick.ellis.w@gmail.com';
export const DEVELOPER_NAME = 'Patrick Ellis';

/** How long cached match data is kept before it is deleted. */
export const RETENTION_DAYS = 30;

/** Riot API endpoints the product uses. */
export const RIOT_APIS = ['TFT-MATCH-V1', 'TFT-LEAGUE-V1', 'ACCOUNT-V1'] as const;

/** Date the legal pages were last updated (ISO yyyy-mm-dd). */
export const LEGAL_UPDATED = '2026-10-10';

/** Riot Games' required "Legal Jibber Jabber" notice for third-party products. */
export const RIOT_DISCLAIMER =
	"TFT Personal Tutor isn't endorsed by Riot Games and doesn't reflect the views or opinions of Riot Games or anyone officially involved in producing or managing Riot Games properties. Riot Games, Teamfight Tactics and all associated properties are trademarks or registered trademarks of Riot Games, Inc.";
