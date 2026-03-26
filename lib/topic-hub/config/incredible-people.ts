import type { TopicHubConfig } from '@/lib/topic-hub/topic-hub-types';

export const INCREDIBLE_PEOPLE_TOPIC_HUB_CONFIG: TopicHubConfig = {
  slug: 'incredible-people',
  seoOverride: {
    titleAbsolute: 'Incredible People Podcast Episodes | Icons, Rebels & Legends',
    description:
      'Listen to remarkable life stories about iconic figures, unlikely heroes, and people who changed culture and history.',
    socialTitle: 'Incredible People Podcast Episodes | The Compendium',
    socialDescription:
      'Explore extraordinary lives: icons, outsiders, and rule-breakers whose choices reshaped culture, media, and history.',
    socialImageUrl: '/topic-hub-card-backgrounds/incredible-people.avif'
  },
  layout: {
    hero: {
      eyebrow: 'Curated Listening Guide',
      title: 'Incredible People Podcast Episodes',
      mobileTitle: 'Incredible People Episodes',
      descriptor: 'Icons • Outsiders • Rule-Breakers',
      mobileDescriptor: 'Icons • Outsiders • Rule-Breakers',
      intro:
        'Meet icons, outsiders, and unlikely heroes whose choices left real marks on culture, politics, and history. Start with essential picks, then jump by person type.',
      mobileIntro:
        'Start with essential incredible people stories, then jump through icons, rebels, and public figures.',
      card: {
        title: 'Incredible People',
        badge: 'Topic Hub',
        backgroundImageUrl: '/topic-hub-card-backgrounds/incredible-people.avif'
      },
      primaryAction: {
        label: 'Start with the essentials',
        href: '#start-here'
      },
      secondaryAction: {
        label: 'Browse full incredible people archive',
        href: '/episodes?topic=incredible-people'
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
      heading: '3 Essential Incredible People Episodes',
      intro:
        'Start with these three stories for range: a fearless journalist, an uncompromising artist, and a life lived in legal and political limbo.',
      sectionId: 'start-here'
    },
    chips: {
      eyebrow: 'Browse by Subtopic',
      heading: 'Jump to the kind of person you want first',
      intro: 'Use these quick links to jump between icons and artists, Diana\'s royal saga, and rule-breakers.',
      chipOrder: [
        'icons-artists-and-cultural-originals',
        'royals-headlines-and-public-pressure',
        'rule-breakers-explorers-and-outsiders'
      ]
    },
    sectionEyebrow: 'Curated Collection',
    archiveHighlight: {
      heading: 'Want the full archive?',
      body: 'Browse every published Incredible People episode with the topic filter already applied.',
      action: {
        label: 'Browse all incredible people episodes',
        href: '/episodes?topic=incredible-people'
      }
    },
    relatedArticles: {
      eyebrow: 'Related Articles',
      heading: 'Related Reading',
      intro: 'A companion read with extra context and timeline detail.',
      minimumItems: 1
    },
    whyListen: {
      eyebrow: 'WHY THIS PAGE WORKS',
      heading: 'Why this hub is worth exploring',
      intro:
        'These episodes focus on people first: the choices they made, the pressure around them, and the unintended consequences that followed.',
      points: [
        'Character-led storytelling with clear context',
        'A deliberate mix of admired, controversial, and complicated figures',
        'Stories that reveal influence, ambition, fallout, and legacy'
      ]
    },
    faq: {
      eyebrow: 'FAQ',
      heading: 'Frequently Asked Questions',
      items: [
        {
          question: 'Where should I start with Incredible People?',
          answer:
            'Start with the three featured episodes at the top. They give you a strong spread across journalism, art, and unusual personal survival.'
        },
        {
          question: 'What kinds of people are covered here?',
          answer:
            'You will find cultural icons, public figures under intense scrutiny, explorers, outsiders, and people whose personal story changed wider events.'
        },
        {
          question: 'Does this hub include controversial or criminal figures?',
          answer:
            'Yes. The focus is on compelling lives, so the page includes admirable figures alongside people linked to scandal, harm, or public controversy.'
        },
        {
          question: 'What should I listen to next after this page?',
          answer:
            'Continue through the full Incredible People archive, then branch to History, True Crime, or Pop Culture & Entertainment for adjacent story paths.'
        }
      ]
    },
    relatedTopics: {
      eyebrow: 'Related Topics',
      heading: 'Keep exploring adjacent stories',
      intro:
        'If you came for biography, notoriety, and influence, these topic hubs are the strongest next steps.',
      topics: [
        {
          href: '/topics/history',
          title: 'History',
          description: 'Turning points, institutions, and decisions that shaped the world around these people.',
          label: 'Topic Page',
          ctaLabel: 'Explore topic',
          backgroundImageUrl: '/topic-hub-card-backgrounds/history.avif'
        },
        {
          href: '/topics/true-crime',
          title: 'True Crime',
          description: 'Cases where personality, motive, and human behavior are central to the story.',
          label: 'Topic Page',
          ctaLabel: 'Explore topic',
          backgroundImageUrl: '/topic-hub-card-backgrounds/true-crime.avif'
        },
        {
          href: '/topics/pop-culture-entertainment',
          title: 'Pop Culture & Entertainment',
          displayTitle: 'Pop Culture',
          description: 'Fame, media pressure, and public narratives that turn people into cultural symbols.',
          label: 'Topic Page',
          ctaLabel: 'Explore topic',
          backgroundImageUrl: '/topic-hub-card-backgrounds/pop-culture.avif'
        }
      ]
    },
    finalCta: {
      eyebrow: 'Keep Listening',
      heading: 'Browse every Incredible People episode in one place',
      body: 'Ready to go beyond the curated picks? Open the full archive with the Incredible People filter already applied.',
      primaryAction: {
        label: 'Browse all incredible people episodes',
        href: '/episodes?topic=incredible-people'
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
      'nellie-bly-10-days-in-a-mad-house-to-72-days-around-the-world',
      'frida-kahlo-pain-politics-and-the-self-portraits-that-made-an-icon',
      'terminal-man-the-refugee-who-waited-at-an-airport-for-18-years'
    ],
    editorialSections: [
      {
        id: 'icons-artists-and-cultural-originals',
        title: 'Icons, Artists & Cultural Originals',
        intro: 'Visionary creatives and cultural figures whose work and persona outlived their era.',
        chipLabel: 'Icons & Artists',
        minimumEpisodesToRender: 3,
        episodeSlugs: [
          'frida-kahlo-pain-politics-and-the-self-portraits-that-made-an-icon',
          'roald-dahl-a-life-shaped-by-war-words-and-whimsy',
          'dolly-parton-the-legend-behind-the-rhinestones',
          'sixto-rodriguez-the-sugar-man-who-inspired-a-revolution'
        ],
        styleVariant: 'full-bleed-gold',
        maxVisibleEpisodes: 3
      },
      {
        id: 'royals-headlines-and-public-pressure',
        title: 'Princess Diana & Public Scrutiny',
        intro: 'The Diana trilogy, from royal courtship and tabloid pressure to divorce, pursuit, and aftermath.',
        chipLabel: 'Diana & Royals',
        minimumEpisodesToRender: 3,
        episodeSlugs: [
          'princess-diana-part-1-the-royal-romance-that-was-over-before-it-began',
          'princess-diana-part-2-the-truth-behind-her-divorce-from-charles-and-the-royal-fallout',
          'princess-diana-part-3-the-final-year-the-fatal-chase-the-last-goodbye'
        ],
        styleVariant: 'full-bleed-gold',
        maxVisibleEpisodes: 3
      },
      {
        id: 'rule-breakers-explorers-and-outsiders',
        title: 'Rule-Breakers, Explorers & Outsiders',
        intro: 'People who ignored convention, crossed boundaries, or survived through extraordinary circumstances.',
        chipLabel: 'Rule-Breakers',
        minimumEpisodesToRender: 3,
        episodeSlugs: [
          'amelia-earhart-flying-into-the-unknown',
          'julie-d-aubigny-the-sword-fighting-opera-singing-kick-ass-feminist-of-the-17th-century',
          'nellie-bly-10-days-in-a-mad-house-to-72-days-around-the-world',
          'terminal-man-the-refugee-who-waited-at-an-airport-for-18-years'
        ],
        styleVariant: 'full-bleed-gold',
        maxVisibleEpisodes: 3
      }
    ]
  }
};
