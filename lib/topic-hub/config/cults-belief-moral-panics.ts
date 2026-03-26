import type { TopicHubConfig } from '@/lib/topic-hub/topic-hub-types';

export const CULTS_BELIEF_MORAL_PANICS_TOPIC_HUB_CONFIG: TopicHubConfig = {
  slug: 'cults-belief-moral-panics',
  seoOverride: {
    titleAbsolute: 'Cults, Belief & Moral Panics Podcast Episodes | Control',
    description:
      'Explore cults, coercive belief systems, and moral panics where persuasion, fear, and social contagion drove real harm.',
    socialTitle: 'Cults, Belief & Moral Panics Podcast Episodes | The Compendium',
    socialDescription:
      'Listen to stories about cult leaders, conspiracy thinking, and panic-driven movements that reshaped communities through fear and control.',
    socialImageUrl: '/topic-hub-card-backgrounds/Cults.avif'
  },
  layout: {
    hero: {
      eyebrow: 'Curated Listening Guide',
      title: 'Cults, Belief & Moral Panics Podcast Episodes',
      mobileTitle: 'Cults, Belief & Moral Panics',
      descriptor: 'Cults • Persuasion • Social Contagion',
      mobileDescriptor: 'Cults • Persuasion • Social Contagion',
      intro:
        'Explore stories where charismatic authority, fear, and belief pulled people into extreme worlds. Start with essential picks, then jump by cult, coercion, or panic pattern.',
      mobileIntro:
        'Start with essential cult and panic stories, then jump through coercion, belief systems, and social contagion.',
      card: {
        title: 'Cults, Belief & Moral Panics',
        badge: 'Topic Hub',
        backgroundImageUrl: '/topic-hub-card-backgrounds/Cults.avif'
      },
      primaryAction: {
        label: 'Start with the essentials',
        href: '#start-here'
      },
      secondaryAction: {
        label: 'Browse full cults archive',
        href: '/episodes?topic=cults-belief-moral-panics'
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
      heading: '3 Essential Cults, Belief & Moral Panics Episodes',
      intro:
        'Start with these three episodes for range: a moral panic that spiraled, a coercive kidnapping case, and a belief system built on secrecy and control.',
      sectionId: 'start-here'
    },
    chips: {
      eyebrow: 'Browse by Subtopic',
      heading: 'Jump to the psychological pattern you want first',
      intro: 'Use these jump links to move between cult devotion, coercion, and institutional belief control.',
      chipOrder: [
        'cult-devotion-and-doomsday-belief',
        'coercion-and-identity-capture',
        'institutional-belief-and-control'
      ]
    },
    sectionEyebrow: 'Curated Collection',
    archiveHighlight: {
      heading: 'Want the full archive?',
      body: 'Browse every published Cults, Belief & Moral Panics episode with this topic filter already applied.',
      action: {
        label: 'Browse all cults, belief & moral panics episodes',
        href: '/episodes?topic=cults-belief-moral-panics'
      }
    },
    whyListen: {
      eyebrow: 'WHY THIS PAGE WORKS',
      heading: 'Why this hub is worth exploring',
      intro:
        'These episodes focus on group psychology: how belief hardens, how manipulation escalates, and how fear-driven narratives become collective behavior.',
      points: [
        'A focused mix of cult dynamics, moral panic, and coercive influence',
        'Stories that track persuasion from recruitment to social fallout',
        'Clear attention to power, vulnerability, and control mechanisms'
      ]
    },
    faq: {
      eyebrow: 'FAQ',
      heading: 'Frequently Asked Questions',
      items: [
        {
          question: 'Where should I start on this page?',
          answer:
            'Start with the three featured episodes at the top. They give you a fast cross-section of moral panic, coercion, and belief-system control.'
        },
        {
          question: 'What kinds of cult, panic, and belief stories are covered?',
          answer:
            'You will find cult leadership stories, social-hysteria cases, and episodes about persuasive systems that isolated or manipulated followers.'
        },
        {
          question: 'Does this include historical and modern cases?',
          answer:
            'Yes. The hub includes older panic-driven episodes and modern cases involving contemporary movements, institutions, and media pressure.'
        },
        {
          question: 'Does this page cover conspiracies, social contagion, and manipulation?',
          answer:
            'Yes. The curation is built around how ideas spread, how authority is weaponized, and how communities can be pushed toward harmful certainty.'
        },
        {
          question: 'What should I listen to after this hub?',
          answer:
            'Continue through the full cults archive, then branch into True Crime, Mysteries & Unexplained, or History for adjacent stories of motive, belief, and consequence.'
        }
      ]
    },
    relatedTopics: {
      eyebrow: 'Related Topics',
      heading: 'Keep exploring adjacent stories',
      intro:
        'If you came for group psychology, persuasion, and social fallout, these topic hubs are the strongest next steps.',
      topics: [
        {
          href: '/topics/true-crime',
          title: 'True Crime',
          description: 'Investigations where manipulation, motive, and harm are central to the case.',
          label: 'Topic Page',
          ctaLabel: 'Explore topic',
          backgroundImageUrl: '/topic-hub-card-backgrounds/true-crime.avif'
        },
        {
          href: '/topics/mysteries-unexplained',
          title: 'Mysteries & The Unexplained',
          displayTitle: 'Mysteries',
          description: 'Stories where uncertainty, belief, and disputed evidence drive competing narratives.',
          label: 'Topic Page',
          ctaLabel: 'Explore topic',
          backgroundImageUrl: '/topic-hub-card-backgrounds/Mysteries.avif'
        },
        {
          href: '/topics/history',
          title: 'History',
          description: 'Historical movements, social fear cycles, and decisions that normalized extreme behavior.',
          label: 'Topic Page',
          ctaLabel: 'Explore topic',
          backgroundImageUrl: '/topic-hub-card-backgrounds/history.avif'
        }
      ]
    },
    finalCta: {
      eyebrow: 'Keep Listening',
      heading: 'Browse all cults, belief and moral panics episodes in one place',
      body: 'Ready to go beyond the curated picks? Open the full archive with cults, belief and moral panics already filtered in.',
      primaryAction: {
        label: 'Browse all cults, belief & moral panics episodes',
        href: '/episodes?topic=cults-belief-moral-panics'
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
      'the-satanic-panic-a-deep-dive-into-america-s-biggest-child-abuse-scandal',
      'patty-hearst-from-kidnapped-heiress-to-america-s-most-wanted-fugitive',
      'scientology-understanding-their-beliefs-practices-and-scandals'
    ],
    editorialSections: [
      {
        id: 'more-cults-coercion-and-moral-panics',
        title: 'More cults, coercion & moral panics',
        intro: 'Three more stories about belief, manipulation, fear, and control when group pressure turns personal choices into high-stakes consequences.',
        chipLabel: 'More Stories',
        minimumEpisodesToRender: 3,
        episodeSlugs: [
          'heaven-s-gate-cult-between-devotion-and-delusion',
          'sex-cult-the-story-of-bhagwan-rajneesh-and-his-sex-cult-s-bioterror-plot-to-take-over-oregon',
          'inside-scientology-david-miscavige-and-the-vanishing-of-shelly-miscavige'
        ],
        styleVariant: 'full-bleed-gold',
        maxVisibleEpisodes: 3
      }
    ]
  }
};
