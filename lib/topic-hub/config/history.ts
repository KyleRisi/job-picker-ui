import type { TopicHubConfig } from '@/lib/topic-hub/topic-hub-types';

export const HISTORY_TOPIC_HUB_CONFIG: TopicHubConfig = {
  slug: 'history',
  seoOverride: {
    titleAbsolute: 'History Podcast Episodes | Revolutions, Scandals & Turning Points',
    description:
      'Discover history podcast episodes that unpack political turning points, cultural flashpoints, and overlooked historical stories.',
    socialTitle: 'History Podcast Episodes | The Compendium',
    socialDescription:
      'Explore History episodes on political scandals, revolutions, strange social experiments, and the decisions that reshaped the world.',
    socialImageUrl: '/topic-hub-card-backgrounds/history.avif'
  },
  layout: {
    hero: {
      eyebrow: 'Curated Listening Guide',
      title: 'History Podcast Episodes',
      mobileTitle: 'History Episodes',
      descriptor: 'Revolutions • Scandals • Defining Events',
      mobileDescriptor: 'Revolutions • Scandals • Defining Events',
      intro:
        'Browse history podcast episodes focused on turning points, overlooked moments, and the people behind major events. Start with essential episodes, then jump to the era or angle you want first.',
      mobileIntro:
        'Start with essential History episodes, then jump to revolutions, scandals, and stranger corners of the archive.',
      card: {
        title: 'History',
        badge: 'Topic Hub',
        backgroundImageUrl: '/topic-hub-card-backgrounds/history.avif'
      },
      primaryAction: {
        label: 'Start with the essentials',
        href: '#start-here'
      },
      secondaryAction: {
        label: 'Browse full history archive',
        href: '/episodes?topic=history'
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
      heading: '3 Essential History Episodes',
      intro:
        'Start with these three episodes for a strong cross-section of the History hub: political upheaval, collapsing empires, and rivalries that changed science itself.',
      sectionId: 'start-here'
    },
    chips: {
      eyebrow: 'Browse by Subtopic',
      heading: 'Jump to the historical angle you want first',
      intro: 'Use these jump links to move quickly between curated History collections.',
      chipOrder: [
        'power-scandals-revolutions',
        'wars-resistance-and-conflict',
        'odd-history-and-social-experiments'
      ]
    },
    sectionEyebrow: 'Curated Collection',
    archiveHighlight: {
      heading: 'Want the full archive?',
      body: 'Browse every published History episode with the topic filter already applied.',
      action: {
        label: 'Browse all history episodes',
        href: '/episodes?topic=history'
      }
    },
    relatedArticles: {
      eyebrow: 'Related Articles',
      heading: 'Related Articles & Deeper Reading',
      intro: 'Want more context after listening? These companion reads dig deeper into historical lives and timelines.',
      minimumItems: 1
    },
    whyListen: {
      eyebrow: 'WHY THIS PAGE WORKS',
      heading: 'Why our History episodes are worth your time',
      intro:
        'We focus on the decisions, incentives, and unintended consequences behind major historical moments. The goal is not trivia, but context that actually sticks.',
      points: [
        'Clear narratives built around turning points, not textbook sprawl',
        'Context-first storytelling that explains why events mattered',
        'A mix of famous incidents and overlooked episodes with real impact'
      ]
    },
    faq: {
      eyebrow: 'FAQ',
      heading: 'Frequently Asked Questions',
      items: [
        {
          question: 'Where should I start if I am new to the History hub?',
          answer:
            'Start with the three featured episodes at the top of this page. They cover political upheaval, dynastic collapse, and scientific rivalry to give you a fast feel for the range.'
        },
        {
          question: 'Are these episodes deep dives or quick overviews?',
          answer:
            'They are narrative-driven explainers with strong context. You will get enough depth to understand what happened and why it mattered, without getting buried in dates.'
        },
        {
          question: 'What should I listen to next after these picks?',
          answer:
            'Use the curated rows for the angle you prefer, then move to the full History archive. If you want adjacent themes, jump to True Crime, Incredible People, or Pop Culture & Entertainment.'
        }
      ]
    },
    relatedTopics: {
      eyebrow: 'Related Topics',
      heading: 'Keep exploring adjacent stories',
      intro:
        'History overlaps with crime, personalities, and media-driven moments. These hubs are the best next stops after this page.',
      topics: [
        {
          href: '/topics/true-crime',
          title: 'True Crime',
          description: 'Investigations, scandals, and crimes with deep historical context and lasting fallout.',
          label: 'Topic Page',
          ctaLabel: 'Explore topic',
          backgroundImageUrl: '/topic-hub-card-backgrounds/true-crime.avif'
        },
        {
          href: '/topics/incredible-people',
          title: 'Incredible People',
          description: 'Remarkable lives and consequential personalities that shaped culture, politics, and history.',
          label: 'Topic Page',
          ctaLabel: 'Explore topic',
          backgroundImageUrl: '/topic-hub-card-backgrounds/incredible-people.avif'
        },
        {
          href: '/topics/pop-culture-entertainment',
          title: 'Pop Culture & Entertainment',
          displayTitle: 'Pop Culture',
          description: 'Media moments, celebrity stories, and entertainment flashpoints with wider historical impact.',
          label: 'Topic Page',
          ctaLabel: 'Explore topic',
          backgroundImageUrl: '/topic-hub-card-backgrounds/pop-culture.avif'
        }
      ]
    },
    finalCta: {
      eyebrow: 'Keep Listening',
      heading: 'Browse every History episode in one place',
      body: "Ready to go beyond the curated picks? Open the full History archive with the topic filter already applied.",
      primaryAction: {
        label: 'Browse all history episodes',
        href: '/episodes?topic=history'
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
      'guy-fawkes-treason-torture-and-the-birth-of-bonfire-night',
      'the-execution-of-the-romanovs-from-russia-s-throne-to-an-unthinkable-fate',
      'bone-wars-the-rivalry-that-rewrote-dinosaur-history'
    ],
    editorialSections: [
      {
        id: 'power-scandals-revolutions',
        title: 'Power, Scandals & Revolutions',
        intro:
          'Episodes about political manipulation, elite excess, and decisions that sparked public backlash or regime change.',
        chipLabel: 'Power & Scandals',
        minimumEpisodesToRender: 3,
        episodeSlugs: [
          'kony-2012-how-social-media-tried-to-stop-a-war',
          'billion-dollar-banquet-how-one-extravagant-party-sparked-the-iranian-revolution',
          'imelda-marcos-corruption-power-6-000-pairs-of-shoes',
          'the-monica-lewinsky-scandal-a-vast-right-wing-conspiracy-of-secrets-lies-and-political-agendas'
        ],
        styleVariant: 'full-bleed-gold',
        maxVisibleEpisodes: 3
      },
      {
        id: 'wars-resistance-and-conflict',
        title: 'Wars, Resistance & Conflict',
        intro: 'War-time stories, long-running conflicts, and the human decisions that made them escalate or endure.',
        chipLabel: 'War & Conflict',
        minimumEpisodesToRender: 2,
        episodeSlugs: [
          'hiroo-onoda-the-last-japanese-soldier-who-kept-on-fighting-after-ww2-had-finished',
          'the-great-emu-war-of-1932-emus-soldiers-and-an-unexpected-war'
        ],
        styleVariant: 'full-bleed-gold',
        maxVisibleEpisodes: 3
      },
      {
        id: 'odd-history-and-social-experiments',
        title: 'Odd History & Social Experiments',
        intro:
          'Strange historical episodes that still reveal something serious about institutions, science, and human behavior.',
        chipLabel: 'Odd History',
        minimumEpisodesToRender: 2,
        episodeSlugs: [
          'the-acali-experiment-science-sex-and-santiago-genoves-s-bizarre-human-behaviour-study',
          'nuns-on-the-run-how-eight-belgian-nuns-outsmarted-the-church'
        ],
        styleVariant: 'full-bleed-gold',
        maxVisibleEpisodes: 3
      }
    ]
  }
};
