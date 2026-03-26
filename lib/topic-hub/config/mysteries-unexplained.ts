import type { TopicHubConfig } from '@/lib/topic-hub/topic-hub-types';

export const MYSTERIES_UNEXPLAINED_TOPIC_HUB_CONFIG: TopicHubConfig = {
  slug: 'mysteries-unexplained',
  seoOverride: {
    titleAbsolute: 'Mysteries & Unexplained Podcast Episodes | Unsolved Stories',
    description:
      'Explore unsolved mysteries and unexplained stories featuring disappearances, strange evidence, and cases that resist clear answers.',
    socialTitle: 'Mysteries & Unexplained Podcast Episodes | The Compendium',
    socialDescription:
      'Listen to unsolved mysteries, unexplained events, and strange timelines where competing theories and missing answers drive the story.',
    socialImageUrl: '/topic-hub-card-backgrounds/Mysteries.avif'
  },
  layout: {
    hero: {
      eyebrow: 'Curated Listening Guide',
      title: 'Mysteries & Unexplained Podcast Episodes',
      mobileTitle: 'Mysteries & Unexplained',
      descriptor: 'Unsolved • Unexplained • Competing Theories',
      mobileDescriptor: 'Unsolved • Unexplained • Competing Theories',
      intro:
        'Explore stories where timelines clash, evidence refuses to settle, and answers remain contested. Start with essential picks, then jump by mystery type.',
      mobileIntro:
        'Start with essential mystery episodes, then jump through disappearances, unexplained events, and theory-heavy cases.',
      card: {
        title: 'Mysteries & Unexplained',
        badge: 'Topic Hub',
        backgroundImageUrl: '/topic-hub-card-backgrounds/Mysteries.avif'
      },
      primaryAction: {
        label: 'Start with the essentials',
        href: '#start-here'
      },
      secondaryAction: {
        label: 'Browse full mysteries archive',
        href: '/episodes?topic=mysteries-unexplained'
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
      heading: '3 Essential Mysteries & Unexplained Episodes',
      intro:
        'Start with these three episodes for range: a locked-room puzzle, a century-long identity mystery, and a case that blurred belief and fear.',
      sectionId: 'start-here'
    },
    chips: {
      eyebrow: 'Browse by Subtopic',
      heading: 'Jump to the mystery style you want first',
      intro: 'Use these jump links to move through vanishings, paranormal claims, and contested narratives.',
      chipOrder: [
        'vanishings-and-identity-puzzles',
        'legends-hauntings-and-paranormal-claims',
        'hoaxes-and-contested-narratives'
      ]
    },
    sectionEyebrow: 'Curated Collection',
    archiveHighlight: {
      heading: 'Want the full archive?',
      body: 'Browse every published Mysteries & Unexplained episode with this topic filter already applied.',
      action: {
        label: 'Browse all mysteries episodes',
        href: '/episodes?topic=mysteries-unexplained'
      }
    },
    whyListen: {
      eyebrow: 'WHY THIS PAGE WORKS',
      heading: 'Why this hub is worth exploring',
      intro:
        'These episodes focus on uncertainty without turning it into noise: what is known, what is missing, and why the key questions still hold.',
      points: [
        'A deliberate mix of disappearances, unexplained incidents, and unresolved claims',
        'Stories built around competing theories instead of forced conclusions',
        'Clear timelines that show exactly where certainty breaks down'
      ]
    },
    faq: {
      eyebrow: 'FAQ',
      heading: 'Frequently Asked Questions',
      items: [
        {
          question: 'Where should I start with Mysteries & Unexplained?',
          answer:
            'Start with the three featured episodes at the top. They give you a fast cross-section of locked-room mystery, identity puzzle, and unexplained-case storytelling.'
        },
        {
          question: 'What kinds of mysteries are covered?',
          answer:
            'You will find unexplained deaths, disappearances, strange sightings, and stories where evidence and timelines point in different directions.'
        },
        {
          question: 'Does this include unexplained events, disappearances, and unsolved stories?',
          answer:
            'Yes. The curation is built around all three, with cases chosen for unresolved evidence and enduring uncertainty.'
        },
        {
          question: 'What should I explore next after this page?',
          answer:
            'Continue through the full mysteries archive, then branch to True Crime, Disasters & Survival, or History for adjacent cases with high uncertainty and consequence.'
        }
      ]
    },
    relatedTopics: {
      eyebrow: 'Related Topics',
      heading: 'Keep exploring adjacent stories',
      intro:
        'If you came for uncertainty, unresolved evidence, and human behavior under pressure, these are the best next hubs.',
      topics: [
        {
          href: '/topics/true-crime',
          title: 'True Crime',
          description: 'Cases where motive, evidence, and investigative detail drive unresolved questions.',
          label: 'Topic Page',
          ctaLabel: 'Explore topic',
          backgroundImageUrl: '/topic-hub-card-backgrounds/true-crime.avif'
        },
        {
          href: '/topics/disasters-survival',
          title: 'Disasters & Survival',
          description: 'High-stakes stories where chaos, missing information, and survival decisions shape outcomes.',
          label: 'Topic Page',
          ctaLabel: 'Explore topic',
          backgroundImageUrl: '/topic-hub-card-backgrounds/disasters.avif'
        },
        {
          href: '/topics/history',
          title: 'History',
          description: 'Events with disputed narratives, overlooked evidence, and consequences that lasted.',
          label: 'Topic Page',
          ctaLabel: 'Explore topic',
          backgroundImageUrl: '/topic-hub-card-backgrounds/history.avif'
        }
      ]
    },
    finalCta: {
      eyebrow: 'Keep Listening',
      heading: 'Browse all mysteries and unexplained episodes in one place',
      body: 'Ready to go beyond the curated picks? Open the full archive with mysteries and unexplained already filtered in.',
      primaryAction: {
        label: 'Browse all mysteries episodes',
        href: '/episodes?topic=mysteries-unexplained'
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
      'body-in-room-348-how-a-locked-room-led-to-an-impossible-answer',
      'bobby-dunbar-the-missing-child-case-solved-by-a-century-late-dna-test',
      'the-exorcism-of-roland-doe-the-true-story-behind-the-exorcist'
    ],
    editorialSections: [
      {
        id: 'vanishings-and-identity-puzzles',
        title: 'Vanishings & Identity Puzzles',
        intro: 'Cases built around missing people, uncertain identities, and timelines that refuse to resolve cleanly.',
        chipLabel: 'Vanishings',
        minimumEpisodesToRender: 2,
        episodeSlugs: [
          'jennifer-fairgate-the-woman-with-no-past',
          'lars-mittank-from-airport-cctv-to-an-unsolved-mystery',
          'the-alcatraz-escape-the-unbelievable-true-story-of-the-great-prison-break'
        ],
        styleVariant: 'full-bleed-gold',
        maxVisibleEpisodes: 3
      },
      {
        id: 'legends-hauntings-and-paranormal-claims',
        title: 'Legends, Hauntings & Paranormal Claims',
        intro: 'Stories where witness accounts, folklore, and belief collide with incomplete or disputed evidence.',
        chipLabel: 'Paranormal',
        minimumEpisodesToRender: 2,
        episodeSlugs: [
          'the-enfield-poltergeist-haunting-on-green-street',
          'annabelle-doll-and-the-winchester-mystery-house',
          'exploring-bigfoot-a-myth-or-reality'
        ],
        styleVariant: 'full-bleed-gold',
        maxVisibleEpisodes: 3
      },
      {
        id: 'hoaxes-and-contested-narratives',
        title: 'Hoaxes & Contested Narratives',
        intro: 'Mysteries shaped by rumor, media pressure, and claims that stayed influential even as evidence shifted.',
        chipLabel: 'Hoaxes & Narratives',
        minimumEpisodesToRender: 2,
        episodeSlugs: [
          'the-loch-ness-monster-hoax-how-a-man-named-marmaduke-fooled-the-world',
          'the-curse-of-the-cecil-america-s-most-dangerous-hotel'
        ],
        styleVariant: 'full-bleed-gold',
        maxVisibleEpisodes: 3
      }
    ]
  }
};
