import type { TopicHubConfig } from '@/lib/topic-hub/topic-hub-types';

export const SCAMS_HOAXES_CONS_TOPIC_HUB_CONFIG: TopicHubConfig = {
  slug: 'scams-hoaxes-cons',
  seoOverride: {
    titleAbsolute: 'Scams, Hoaxes & Cons Podcast Episodes | Fraud Stories',
    description:
      'Explore scams, hoaxes, and cons episodes on fraud, manipulation, cover-ups, and the fallout when deception goes public.',
    socialTitle: 'Scams, Hoaxes & Cons Podcast Episodes | The Compendium',
    socialDescription:
      'Listen to scams, hoaxes, and con stories about fraud, media manipulation, fake identities, and institutional deceit.',
    socialImageUrl: '/topic-hub-card-backgrounds/scams.avif'
  },
  layout: {
    hero: {
      eyebrow: 'Curated Listening Guide',
      title: 'Scams, Hoaxes & Cons Podcast Episodes',
      mobileTitle: 'Scams, Hoaxes & Cons',
      descriptor: 'Frauds • Hoaxes • Manipulation',
      mobileDescriptor: 'Frauds • Hoaxes • Manipulation',
      intro:
        'Meet con artists, fraudsters, hoaxers and public manipulators whose lies fooled audiences, institutions, and entire communities. Start with essential picks, then jump by deception style.',
      mobileIntro:
        'Start with essential scams and hoaxes episodes, then jump through fraud, cons, and media deception.',
      card: {
        title: 'Scams, Hoaxes & Cons',
        badge: 'Topic Hub',
        backgroundImageUrl: '/topic-hub-card-backgrounds/scams.avif'
      },
      primaryAction: {
        label: 'Start with the essentials',
        href: '#start-here'
      },
      secondaryAction: {
        label: 'Browse full scams archive',
        href: '/episodes?topic=scams-hoaxes-cons'
      },
      tertiaryAction: {
        label: 'Listen on Spotify',
        href: 'https://open.spotify.com/show/30Hh0xbotgbIyCL5tJE4zJ',
        external: true
      },
      trustStripItems: []
    },
    startHere: {
      eyebrow: 'Start Here',
      heading: '3 Essential Scam & Hoax Episodes',
      intro:
        'Start with these three episodes for range: a rigged promotional empire, a wellness fraud built on false illness claims, and a high-profile identity hoax.',
      sectionId: 'start-here'
    },
    chips: {
      eyebrow: 'Browse by Subtopic',
      heading: 'Jump to the deception style you want first',
      intro: 'Use these jump links to move between fraud, social grifts, public hoaxes, and high-stakes bluffs.',
      chipOrder: [
        'corporate-fraud-and-institutional-deceit',
        'con-artists-and-fake-identities',
        'hoaxes-media-hype-and-public-belief',
        'heists-bluffs-and-high-stakes-scams'
      ]
    },
    sectionEyebrow: 'Curated Collection',
    archiveHighlight: {
      heading: 'Want the full archive?',
      body: 'Browse every published scams, hoaxes, and cons episode with this topic filter already applied.',
      action: {
        label: 'Browse all scams, hoaxes & cons episodes',
        href: '/episodes?topic=scams-hoaxes-cons'
      }
    },
    whyListen: {
      eyebrow: 'WHY THIS PAGE WORKS',
      heading: 'Why this hub is worth exploring',
      intro:
        'These episodes trace how deception is constructed, sold, and defended, then what happens when the story collapses.',
      points: [
        'A deliberate mix of financial frauds, identity cons, and public hoaxes',
        'Stories that show both individual grifters and institutional failures',
        'Clear narrative arcs from buildup to exposure to fallout'
      ]
    },
    faq: {
      eyebrow: 'FAQ',
      heading: 'Frequently Asked Questions',
      items: [
        {
          question: 'Where should I start on this page?',
          answer:
            'Start with the three featured episodes at the top. They give you a quick spread across corporate fraud, wellness deception, and identity hoax storytelling.'
        },
        {
          question: 'What kinds of deception stories are covered?',
          answer:
            'You will find fraud cases, fake-identity cons, media-driven hoaxes, and stories where public belief or institutional trust gets exploited.'
        },
        {
          question: 'Does this include corporate, criminal, and media hoaxes?',
          answer:
            'Yes. The page spans all three, from executive fraud and gallery scams to viral hoaxes and narrative manipulation.'
        },
        {
          question: 'What should I listen to after this hub?',
          answer:
            'Open the full scams archive, then branch into True Crime, Pop Culture & Entertainment, or History for adjacent stories of motive, influence, and fallout.'
        }
      ]
    },
    relatedTopics: {
      eyebrow: 'Related Topics',
      heading: 'Keep exploring adjacent stories',
      intro:
        'If you came for manipulation, motive, and fallout, these hubs are the strongest next steps.',
      topics: [
        {
          href: '/topics/true-crime',
          title: 'True Crime',
          description: 'Cases where criminal behavior, motive, and investigative detail drive the story.',
          label: 'Topic Page',
          ctaLabel: 'Explore topic',
          backgroundImageUrl: '/topic-hub-card-backgrounds/true-crime.avif'
        },
        {
          href: '/topics/pop-culture-entertainment',
          title: 'Pop Culture & Entertainment',
          displayTitle: 'Pop Culture',
          description: 'Media narratives, celebrity influence, and public spectacle around contested stories.',
          label: 'Topic Page',
          ctaLabel: 'Explore topic',
          backgroundImageUrl: '/topic-hub-card-backgrounds/pop-culture.avif'
        },
        {
          href: '/topics/history',
          title: 'History',
          description: 'Older scandals, social dynamics, and power decisions that still shape how people get deceived.',
          label: 'Topic Page',
          ctaLabel: 'Explore topic',
          backgroundImageUrl: '/topic-hub-card-backgrounds/history.avif'
        }
      ]
    },
    finalCta: {
      eyebrow: 'Keep Listening',
      heading: 'Browse all scams, hoaxes and cons episodes in one place',
      body: 'Ready to go beyond the curated picks? Open the full archive with scams, hoaxes and cons already filtered in.',
      primaryAction: {
        label: 'Browse all scams, hoaxes & cons episodes',
        href: '/episodes?topic=scams-hoaxes-cons'
      },
      secondaryAction: {
        label: 'Listen on Spotify',
        href: 'https://open.spotify.com/show/30Hh0xbotgbIyCL5tJE4zJ',
        external: true
      }
    },
    episodeCardCtaLabel: 'Open Episode',
    showInlinePlayer: false,
    minimalCard: true
  },
  curation: {
    featuredEpisodeSlugs: [
      'mcmillions-when-america-s-biggest-game-stopped-being-a-game',
      'belle-gibson-the-fake-cancer-survivor-who-built-a-wellness-empire',
      'tania-head-the-9-11-survivor-who-wasn-t-there'
    ],
    editorialSections: [
      {
        id: 'corporate-fraud-and-institutional-deceit',
        title: 'Corporate Fraud & Institutional Deceit',
        intro: 'Where trusted systems and professional authority were used to sell lies at scale.',
        chipLabel: 'Corporate Fraud',
        minimumEpisodesToRender: 3,
        episodeSlugs: [
          'revisited-elizabeth-holmes-silicon-valley-s-greatest-fraud',
          'knoedler-gallery-scandal-the-greatest-art-fraud-of-the-century',
          'dr-donald-cline-conceived-in-deceit-the-infamous-fertility-scandal'
        ],
        styleVariant: 'full-bleed-gold',
        maxVisibleEpisodes: 3
      },
      {
        id: 'con-artists-and-fake-identities',
        title: 'Con Artists & Fake Identities',
        intro: 'Personal grifts built on invented status, manufactured trust, and social engineering.',
        chipLabel: 'Con Artists',
        minimumEpisodesToRender: 3,
        episodeSlugs: [
          'anna-delvey-from-rags-to-riches-to-rikers-new-yorks-fake-heiress',
          'cassie-chadwick-carnegie-s-imaginary-heir-queen-of-the-con',
          'rudy-kurniawan-the-man-who-duped-the-elite-with-fake-fine-wines'
        ],
        styleVariant: 'full-bleed-gold',
        maxVisibleEpisodes: 3
      },
      {
        id: 'hoaxes-media-hype-and-public-belief',
        title: 'Hoaxes, Media Hype & Public Belief',
        intro: 'Stories where attention cycles and viral narratives turned deception into mainstream spectacle.',
        chipLabel: 'Public Hoaxes',
        minimumEpisodesToRender: 3,
        episodeSlugs: [
          'balloon-boy-hoax-the-viral-media-circus-that-spiraled-out-of-control',
          'fyre-festival-the-greatest-party-that-never-happened',
          'jt-leroy-gender-deception-and-the-ultimate-hoax'
        ],
        styleVariant: 'full-bleed-gold',
        maxVisibleEpisodes: 3
      },
      {
        id: 'heists-bluffs-and-high-stakes-scams',
        title: 'Heists, Bluffs & High-Stakes Scams',
        intro: 'Brazen operations where planning, performance, and nerve mattered as much as the crime itself.',
        chipLabel: 'Heists & Bluffs',
        minimumEpisodesToRender: 3,
        episodeSlugs: [
          'millennium-dome-diamond-heist-the-plot-to-steal-the-worlds-most-flawless-diamond',
          'the-santa-claus-bank-robbery-blunder',
          'd-b-tuber-the-most-ridiculous-robbery-in-american-history'
        ],
        styleVariant: 'full-bleed-gold',
        maxVisibleEpisodes: 3
      }
    ]
  }
};
