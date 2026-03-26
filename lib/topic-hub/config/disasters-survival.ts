import type { TopicHubConfig } from '@/lib/topic-hub/topic-hub-types';

export const DISASTERS_SURVIVAL_TOPIC_HUB_CONFIG: TopicHubConfig = {
  slug: 'disasters-survival',
  seoOverride: {
    titleAbsolute: 'Disasters & Survival Podcast Episodes | Catastrophe Stories',
    description:
      'Explore disasters and survival episodes on catastrophe, rescue efforts, human error, and extraordinary endurance under pressure.',
    socialTitle: 'Disasters & Survival Podcast Episodes | The Compendium',
    socialDescription:
      'Listen to stories of catastrophe and endurance, from system failures and maritime disasters to rescue missions and survival against the odds.',
    socialImageUrl: '/topic-hub-card-backgrounds/disasters.avif'
  },
  layout: {
    hero: {
      eyebrow: 'Curated Listening Guide',
      title: 'Disasters & Survival Podcast Episodes',
      mobileTitle: 'Disasters & Survival',
      descriptor: 'Catastrophe • Endurance • Rescue',
      mobileDescriptor: 'Catastrophe • Endurance • Rescue',
      intro:
        'Explore disaster stories where systems fail, plans unravel, and survival instincts take over. Start with essential picks, then jump by catastrophe and survival type.',
      mobileIntro:
        'Start with essential disaster and survival stories, then jump through catastrophe, rescue, and endurance.',
      card: {
        title: 'Disasters & Survival',
        badge: 'Topic Hub',
        backgroundImageUrl: '/topic-hub-card-backgrounds/disasters.avif'
      },
      primaryAction: {
        label: 'Start with the essentials',
        href: '#start-here'
      },
      secondaryAction: {
        label: 'Browse full disasters archive',
        href: '/episodes?topic=disasters-survival'
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
      heading: '3 Essential Disasters & Survival Episodes',
      intro:
        'Start with these three episodes for range: a nuclear catastrophe, a high-altitude survival ordeal, and one of the most urgent rescue stories in modern media.',
      sectionId: 'start-here'
    },
    chips: {
      eyebrow: 'Browse by Subtopic',
      heading: 'Jump to the kind of disaster story you want first',
      intro: 'Use these jump links to move between system failures, maritime disasters, survival stories, and rescue chaos.',
      chipOrder: [
        'system-failures-and-collapse',
        'maritime-disasters-and-open-water-risk',
        'survival-under-extreme-pressure',
        'entrapment-rescue-and-public-chaos'
      ]
    },
    sectionEyebrow: 'Curated Collection',
    archiveHighlight: {
      heading: 'Want the full archive?',
      body: 'Browse every published Disasters & Survival episode with this topic filter already applied.',
      action: {
        label: 'Browse all disasters & survival episodes',
        href: '/episodes?topic=disasters-survival'
      }
    },
    relatedArticles: {
      eyebrow: 'Related Articles',
      heading: 'Related Reading',
      intro: 'A companion read with deeper context on one of the hub’s standout catastrophe stories.',
      minimumItems: 1
    },
    whyListen: {
      eyebrow: 'WHY THIS PAGE WORKS',
      heading: 'Why this hub is worth exploring',
      intro:
        'These episodes focus on the turning points inside crisis moments: what failed, what held, and what people did when normal options ran out.',
      points: [
        'A deliberate mix of large-scale disasters and individual survival stories',
        'Coverage of both human error and extreme environmental pressure',
        'Clear narrative arcs from warning signs to impact to aftermath'
      ]
    },
    faq: {
      eyebrow: 'FAQ',
      heading: 'Frequently Asked Questions',
      items: [
        {
          question: 'Where should I start with Disasters & Survival?',
          answer:
            'Start with the three featured episodes at the top. They give you a strong spread across catastrophe, endurance, and rescue storytelling.'
        },
        {
          question: 'What kinds of stories are covered on this page?',
          answer:
            'You will find industrial failures, maritime disasters, entrapment incidents, and survival stories where split-second decisions changed outcomes.'
        },
        {
          question: 'Does this include natural disasters, human error, and survival cases?',
          answer:
            'Yes. The curation spans all three, from system breakdowns and engineering failures to isolated survival and recovery efforts.'
        },
        {
          question: 'What should I listen to after this page?',
          answer:
            'Continue through the full disasters archive, then branch to History, True Crime, or Incredible People for adjacent stories of risk, consequence, and resilience.'
        }
      ]
    },
    relatedTopics: {
      eyebrow: 'Related Topics',
      heading: 'Keep exploring adjacent stories',
      intro:
        'If you came for catastrophe, endurance, and human decisions under pressure, these are the best next hubs.',
      topics: [
        {
          href: '/topics/history',
          title: 'History',
          description: 'Past turning points, institutional failures, and events that reshaped public life.',
          label: 'Topic Page',
          ctaLabel: 'Explore topic',
          backgroundImageUrl: '/topic-hub-card-backgrounds/history.avif'
        },
        {
          href: '/topics/true-crime',
          title: 'True Crime',
          description: 'Cases where negligence, motive, and investigative detail are central to what happened.',
          label: 'Topic Page',
          ctaLabel: 'Explore topic',
          backgroundImageUrl: '/topic-hub-card-backgrounds/true-crime.avif'
        },
        {
          href: '/topics/incredible-people',
          title: 'Incredible People',
          description: 'Remarkable individuals whose decisions and endurance shaped extraordinary outcomes.',
          label: 'Topic Page',
          ctaLabel: 'Explore topic',
          backgroundImageUrl: '/topic-hub-card-backgrounds/incredible-people.avif'
        }
      ]
    },
    finalCta: {
      eyebrow: 'Keep Listening',
      heading: 'Browse all disasters and survival episodes in one place',
      body: 'Ready to go beyond the curated picks? Open the full archive with disasters and survival already filtered in.',
      primaryAction: {
        label: 'Browse all disasters & survival episodes',
        href: '/episodes?topic=disasters-survival'
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
      'the-chernobyl-disaster-what-really-happened-at-01-23-40-on-april-26th-1986',
      'revisited-the-miracle-of-the-andes-the-story-of-a-group-of-survivors-of-a-plane-crash-in-the-andes-in-1972',
      'baby-jessica-the-girl-who-fell-down-a-well-and-changed-news-forever'
    ],
    editorialSections: [
      {
        id: 'system-failures-and-collapse',
        title: 'System Failures & Collapse',
        intro: 'High-consequence breakdowns where design flaws, bad assumptions, or execution failures triggered disaster.',
        chipLabel: 'System Failures',
        minimumEpisodesToRender: 3,
        episodeSlugs: [
          'biosphere-2-the-grand-experiment-that-could-not-breathe',
          'the-challenger-disaster-christa-mcauliffe-s-legacy-beyond-the-space-shuttle-explosion',
          'the-hindenburg-disaster-the-fiery-end-of-the-golden-age-of-airships'
        ],
        styleVariant: 'full-bleed-gold',
        maxVisibleEpisodes: 3
      },
      {
        id: 'maritime-disasters-and-open-water-risk',
        title: 'Maritime Disasters & Survival at Sea',
        intro: 'Sea and sub-sea incidents where equipment limits, environment, and timing forced survival decisions under pressure.',
        chipLabel: 'Maritime Disasters',
        minimumEpisodesToRender: 3,
        episodeSlugs: [
          'oceangate-titan-disaster-a-billionaire-s-dive-into-hubris-history-and-horror',
          'revisited-the-titanic-part-1-the-people-the-passions-the-legend',
          'the-titanic-part-2-the-voyage-the-iceberg-the-aftermath'
        ],
        styleVariant: 'full-bleed-gold',
        maxVisibleEpisodes: 3
      },
      {
        id: 'survival-under-extreme-pressure',
        title: 'Survival Under Extreme Pressure',
        intro: 'Close calls where endurance, improvisation, and calm decision-making made the difference.',
        chipLabel: 'Survival Stories',
        minimumEpisodesToRender: 3,
        episodeSlugs: [
          'last-breath-the-true-story-of-chris-lemons-near-death-experience-in-the-north-sea',
          'survival-at-sea-the-harrowing-tale-of-the-trashman-yacht-sinking',
          'when-hippos-attack-nightmare-on-the-zambezi-and-the-miracle-paddle-that-saved-their-lives'
        ],
        styleVariant: 'full-bleed-gold',
        maxVisibleEpisodes: 3
      },
      {
        id: 'entrapment-rescue-and-public-chaos',
        title: 'Entrapment, Rescue & Public Chaos',
        intro: 'Stories of people trapped in impossible situations while rescue efforts and public attention escalated fast.',
        chipLabel: 'Rescue & Chaos',
        minimumEpisodesToRender: 3,
        episodeSlugs: [
          'nutty-putty-cave-the-john-edward-jones-story-that-haunts-cavers-to-this-day',
          'poop-cruise-the-carnival-triumph-disaster-that-stranded-thousands-without-toilets',
          'balloonfest-clevelands-1986-float-tastrophe-of-epic-proportions'
        ],
        styleVariant: 'full-bleed-gold',
        maxVisibleEpisodes: 3
      }
    ]
  }
};
