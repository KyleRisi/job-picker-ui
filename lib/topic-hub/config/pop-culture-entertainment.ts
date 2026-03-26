import type { TopicHubConfig } from '@/lib/topic-hub/topic-hub-types';

export const POP_CULTURE_ENTERTAINMENT_TOPIC_HUB_CONFIG: TopicHubConfig = {
  slug: 'pop-culture-entertainment',
  seoOverride: {
    titleAbsolute: 'Pop Culture Podcast Episodes | Fame, Scandals & Media',
    description:
      'Explore pop culture and entertainment episodes on celebrity scandals, media frenzies, iconic performers, and stories that shaped public obsession.',
    socialTitle: 'Pop Culture Podcast Episodes | The Compendium',
    socialDescription:
      'Listen to stories about fame, spectacle, scandals, and entertainment moments that changed what audiences watched and talked about.',
    socialImageUrl: '/topic-hub-card-backgrounds/pop-culture.avif'
  },
  layout: {
    hero: {
      eyebrow: 'Curated Listening Guide',
      title: 'Pop Culture & Entertainment Podcast Episodes',
      mobileTitle: 'Pop Culture Episodes',
      descriptor: 'Fame • Spectacle • Cultural Fallout',
      mobileDescriptor: 'Fame • Spectacle • Cultural Fallout',
      intro:
        'Explore stories of fame, media obsession, and entertainment moments that spiraled into cultural flashpoints. Start with essential picks, then jump by spectacle type.',
      mobileIntro:
        'Start with essential pop culture stories, then jump through media spectacle, icon-making, and entertainment scandals.',
      card: {
        title: 'Pop Culture & Entertainment',
        badge: 'Topic Hub',
        backgroundImageUrl: '/topic-hub-card-backgrounds/pop-culture.avif'
      },
      primaryAction: {
        label: 'Start with the essentials',
        href: '#start-here'
      },
      secondaryAction: {
        label: 'Browse full pop culture archive',
        href: '/episodes?topic=pop-culture-entertainment'
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
      heading: '3 Essential Pop Culture Episodes',
      intro:
        'Start with these three episodes for range: a game-show scandal, a disco-era cultural icon story, and a film production that became legendary for all the wrong reasons.',
      sectionId: 'start-here'
    },
    chips: {
      eyebrow: 'Browse by Subtopic',
      heading: 'Jump to the entertainment angle you want first',
      intro: 'Use these jump links to move between celebrity fallout, media stunts, music-world scandals, and cultural oddities.',
      chipOrder: [
        'celebrity-fallout-and-image-collapse',
        'media-stunts-and-television-chaos',
        'music-fame-fraud-and-fandom',
        'culture-oddities-and-industry-feuds'
      ]
    },
    sectionEyebrow: 'Curated Collection',
    archiveHighlight: {
      heading: 'Want the full archive?',
      body: 'Browse every published Pop Culture & Entertainment episode with this topic filter already applied.',
      action: {
        label: 'Browse all pop culture episodes',
        href: '/episodes?topic=pop-culture-entertainment'
      }
    },
    whyListen: {
      eyebrow: 'WHY THIS PAGE WORKS',
      heading: 'Why this hub is worth exploring',
      intro:
        'These episodes track how entertainment stories become public events, then how image, rumor, and media pressure reshape what people believe happened.',
      points: [
        'A mix of celebrity narratives, industry scandals, and media spectacles',
        'Stories chosen for cultural imprint, not just headline noise',
        'Clear arcs from hype and attention to backlash and legacy'
      ]
    },
    faq: {
      eyebrow: 'FAQ',
      heading: 'Frequently Asked Questions',
      items: [
        {
          question: 'Where should I start with Pop Culture & Entertainment?',
          answer:
            'Start with the three featured episodes at the top. They give you a quick cross-section of television scandal, cultural iconography, and production chaos.'
        },
        {
          question: 'What kinds of stories are covered on this page?',
          answer:
            'You will find celebrity scandals, reality-TV manipulations, music-industry deception, and entertainment moments that became wider cultural talking points.'
        },
        {
          question: 'Does this include celebrity scandals, media moments, and cultural icons?',
          answer:
            'Yes. The curation is built around all three, with episodes chosen for public fascination and long-tail cultural impact.'
        },
        {
          question: 'Does this page mix funny, dark, and strange stories?',
          answer:
            'Yes. It intentionally mixes absurd media stories with darker fame narratives and high-stakes entertainment scandals.'
        },
        {
          question: 'What should I listen to after this hub?',
          answer:
            'Continue through the full pop culture archive, then branch to Incredible People, Scams, Hoaxes & Cons, or History for adjacent stories of influence and fallout.'
        }
      ]
    },
    relatedTopics: {
      eyebrow: 'Related Topics',
      heading: 'Keep exploring adjacent stories',
      intro:
        'If you came for fame, influence, and narrative spin, these topic hubs are the strongest next steps.',
      topics: [
        {
          href: '/topics/incredible-people',
          title: 'Incredible People',
          description: 'Remarkable public figures whose lives shaped culture, reputation, and influence.',
          label: 'Topic Page',
          ctaLabel: 'Explore topic',
          backgroundImageUrl: '/topic-hub-card-backgrounds/incredible-people.avif'
        },
        {
          href: '/topics/scams-hoaxes-cons',
          title: 'Scams, Hoaxes & Cons',
          description: 'Stories where spin, fraud, and narrative engineering drove public belief.',
          label: 'Topic Page',
          ctaLabel: 'Explore topic',
          backgroundImageUrl: '/topic-hub-card-backgrounds/scams.avif'
        },
        {
          href: '/topics/history',
          title: 'History',
          description: 'The historical context behind major media moments, scandals, and cultural shifts.',
          label: 'Topic Page',
          ctaLabel: 'Explore topic',
          backgroundImageUrl: '/topic-hub-card-backgrounds/history.avif'
        }
      ]
    },
    finalCta: {
      eyebrow: 'Keep Listening',
      heading: 'Browse all pop culture and entertainment episodes in one place',
      body: 'Ready to go beyond the curated picks? Open the full archive with pop culture and entertainment already filtered in.',
      primaryAction: {
        label: 'Browse all pop culture episodes',
        href: '/episodes?topic=pop-culture-entertainment'
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
      'the-millionaire-cough-britain-s-biggest-game-show-scandal',
      'village-people-disco-beats-cultural-shifts-and-gay-icons',
      'roar-the-story-of-the-most-dangerous-film-ever-made'
    ],
    editorialSections: [
      {
        id: 'celebrity-fallout-and-image-collapse',
        title: 'Celebrity Fallout & Image Collapse',
        intro: 'High-visibility fame stories where public persona, pressure, and scandal collided.',
        chipLabel: 'Celebrity Fallout',
        minimumEpisodesToRender: 3,
        episodeSlugs: [
          'revisited-house-of-gucci-a-tale-of-glamour-greed-and-grudges',
          'revisited-the-chippendales-a-story-of-fame-money-and-murder',
          'michael-alig-glitz-glamour-and-killing-for-fame'
        ],
        styleVariant: 'full-bleed-gold',
        maxVisibleEpisodes: 3
      },
      {
        id: 'media-stunts-and-television-chaos',
        title: 'Media Stunts & Television Chaos',
        intro: 'Broadcast-era stories where production choices, spectacle, and public reaction overtook the original show.',
        chipLabel: 'Media Stunts',
        minimumEpisodesToRender: 3,
        episodeSlugs: [
          'space-cadets-how-a-british-reality-show-convinced-contestants-they-were-in-space',
          'jerry-springer-behind-the-scenes-of-tv-s-most-famous-fights',
          'the-61st-academy-awards-the-worst-oscars-ceremony-ever'
        ],
        styleVariant: 'full-bleed-gold',
        maxVisibleEpisodes: 3
      },
      {
        id: 'music-fame-fraud-and-fandom',
        title: 'Music, Fame, Fraud & Fandom',
        intro: 'Music-industry stories shaped by branding, illusion, and the machinery of mass fandom.',
        chipLabel: 'Music & Fame',
        minimumEpisodesToRender: 3,
        episodeSlugs: [
          'milli-vanilli-the-real-story-behind-greatest-lip-sync-scandal-in-music-history',
          'lou-pearlman-boy-bands-big-lies-and-bigger-scams',
          'the-crazy-story-of-tetris-from-ussr-blocks-to-usa-stardom'
        ],
        styleVariant: 'full-bleed-gold',
        maxVisibleEpisodes: 3
      },
      {
        id: 'culture-oddities-and-industry-feuds',
        title: 'Cultural Oddities & Public Feuds',
        intro: 'Strange side-stories and public creative clashes that reveal how status and attention work in entertainment.',
        chipLabel: 'Oddities & Feuds',
        minimumEpisodesToRender: 3,
        episodeSlugs: [
          'secret-mall-apartment-how-an-artist-lived-in-a-mall-for-4-years-without-getting-caught',
          'anish-kapoor-vs-stuart-semple-the-art-world-s-pettiest-feud',
          'revisited-nuns-on-the-run-how-eight-belgian-nuns-outsmarted-the-church'
        ],
        styleVariant: 'full-bleed-gold',
        maxVisibleEpisodes: 3
      }
    ]
  }
};
