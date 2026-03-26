import type { TopicHubConfig } from '@/lib/topic-hub/topic-hub-types';

export const TRUE_CRIME_TOPIC_HUB_CONFIG: TopicHubConfig = {
  slug: 'true-crime',
  seoOverride: {
    titleAbsolute: 'True Crime Podcast Episodes | The Compendium',
    description:
      'Explore true crime podcast episodes on murders, disappearances, scams, frauds, and unsolved cases from The Compendium.',
    socialTitle: 'True Crime Podcast Episodes | The Compendium',
    socialDescription:
      'Explore true crime podcast episodes on murders, disappearances, scams, frauds, and unsolved cases from The Compendium.',
    socialImageUrl: '/topic-hub-card-backgrounds/true-crime.avif'
  },
  layout: {
    hero: {
      eyebrow: 'Curated Listening Guide',
      title: 'True Crime Podcast Episodes',
      mobileTitle: 'True Crime Episodes',
      descriptor: 'Murders • Scams • Unsolved Cases',
      mobileDescriptor: 'Murders • Scams • Unsolved Cases',
      intro:
        "Start with The Compendium's standout true crime podcast episodes, covering murders, disappearances, scams, scandals, and unsolved cases. Begin with our essential picks, then browse by case type or jump to the full archive.",
      mobileIntro:
        'Start with our standout true crime episodes, then browse by case type or explore the full archive.',
      cornerArtworkUrl: '/The Compendium Main.jpg',
      card: {
        title: 'True Crime',
        badge: 'Topic Hub',
        backgroundImageUrl: '/The Compendium Main.jpg'
      },
      primaryAction: {
        label: 'Start with the essentials',
        href: '#start-here'
      },
      secondaryAction: {
        label: 'Browse full true crime archive',
        href: '/episodes?topic=true-crime'
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
      heading: '3 Essential True Crime Episodes',
      intro:
        'If you want the best place to begin, start with these three episodes. They show the range of the show: serial crime, wrongful conviction, and modern corporate stalking.',
      sectionId: 'start-here'
    },
    chips: {
      eyebrow: 'Browse by Case Type',
      heading: 'Jump to the case style you want first',
      intro: 'Use this quick jump bar to move directly between curated case collections.',
      chipOrder: [
        'murders-serial-killers-notorious-cases',
        'kidnappings-missing-persons-unsolved-cases',
        'british-true-crime-cases',
        'scams-cover-ups-corporate-villainy'
      ]
    },
    sectionEyebrow: 'Curated Collection',
    archiveHighlight: {
      heading: 'Want the full archive?',
      body: 'Browse every published true crime episode, keep the topic filter applied, and move through the archive at your own pace.',
      action: {
        label: 'Browse all true crime episodes',
        href: '/episodes?topic=true-crime'
      }
    },
    relatedArticles: {
      eyebrow: 'Case Explainers & Related Articles',
      heading: 'Case Explainers & Related Articles',
      intro: 'Want more context after listening? These companion reads expand on key cases, timelines, and details.',
      minimumItems: 2
    },
    whyListen: {
      eyebrow: 'WHY THIS PAGE WORKS',
      heading: 'What makes our true crime episodes different',
      intro:
        'At The Compendium, we look beyond the headline. Expect strong storytelling, clear context, and the details that make each case stranger, sadder, or more revealing than it first appears.',
      points: [
        'Clear storytelling, without the waffle',
        'Real context, not just a bag of facts',
        'Cases chosen for strangeness, impact, or cultural weight'
      ]
    },
    faq: {
      eyebrow: 'FAQ',
      heading: 'Frequently Asked Questions',
      items: [
        {
          question: 'What are the best true crime episodes to start with?',
          answer:
            "Start with the featured episodes at the top of this page. They're our best first port of call if you'd like the full Compendium experience without immediately needing a corkboard."
        },
        {
          question: 'Are these episodes serious or comedic?',
          answer:
            'The facts are taken seriously. The delivery is conversational, which makes the stories easier to follow without turning the whole affair into an audition for bleakness.'
        },
        {
          question: 'What should I listen to after this page?',
          answer:
            "If you'd like more cases, head to the full true crime archive. If you're in the mood for neighbouring oddities, move sideways into History, Mysteries & The Unexplained, or Scams, Hoaxes & Cons."
        }
      ]
    },
    relatedTopics: {
      eyebrow: 'Related Topics',
      heading: 'Keep exploring related stories',
      intro:
        'If you came here for investigative storytelling, historical context, or unresolved mysteries, these next topic pages are the best follow-on paths.',
      topics: [
        {
          href: '/topics/history',
          title: 'History',
          description: 'Turning-point moments, strange decisions, and ripple effects still shaping the world now.',
          label: 'Topic Page',
          ctaLabel: 'Explore topic',
          backgroundImageUrl: '/topic-hub-card-backgrounds/history.avif'
        },
        {
          href: '/topics/mysteries-unexplained',
          title: 'Mysteries & The Unexplained',
          displayTitle: 'Mysteries',
          description: 'For unresolved stories, strange disappearances, and the questions that refuse to settle.',
          label: 'Topic Page',
          ctaLabel: 'Explore topic',
          backgroundImageUrl: '/topic-hub-card-backgrounds/Mysteries.avif'
        },
        {
          href: '/topics/scams-hoaxes-cons',
          title: 'Scams, Hoaxes & Cons',
          description: 'Investigate the anatomy of major frauds and hoaxes, from public manipulation to financial collapse.',
          label: 'Topic Page',
          ctaLabel: 'Explore topic',
          backgroundImageUrl: '/topic-hub-card-backgrounds/scams.avif'
        }
      ]
    },
    finalCta: {
      eyebrow: 'Keep Listening',
      heading: 'Browse every true crime episode in one place',
      body: "If you're ready to go beyond the curated picks, head to the full archive with the true crime filter already applied.",
      primaryAction: {
        label: 'Browse all true crime episodes',
        href: '/episodes?topic=true-crime'
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
      'the-suffolk-strangler-steve-wright-the-man-who-made-the-road-home-a-nightmare',
      'west-memphis-three-paradise-lost-justice-lost-innocence-lost',
      'the-2019-ebay-stalking-scandal-when-tech-giants-become-stalkers'
    ],
    editorialSections: [
      {
        id: 'british-true-crime-cases',
        title: 'British True Crime Cases',
        intro: 'Start here for British investigations, trials, disappearances, and major media-covered cases.',
        chipLabel: 'British Cases',
        minimumEpisodesToRender: 2,
        episodeSlugs: [
          'the-suffolk-strangler-steve-wright-the-man-who-made-the-road-home-a-nightmare',
          'lucy-letby-did-she-really-kill-these-babies',
          'the-millionaire-cough-britain-s-biggest-game-show-scandal'
        ],
        styleVariant: 'full-bleed-gold',
        maxVisibleEpisodes: 3,
        taxonomyCollectionSlug: 'british-cases'
      },
      {
        id: 'murders-serial-killers-notorious-cases',
        title: 'Murders & Serial Killers',
        intro: 'Cases defined by violence, notoriety, and the long trail they leave behind.',
        chipLabel: 'Murders',
        minimumEpisodesToRender: 3,
        episodeSlugs: [
          'hillside-strangler-murder-in-the-shadows-of-los-angeles',
          'chaos-charles-manson-and-the-manson-murders',
          'monster-of-florence-the-real-life-horror-behind-an-italian-legend',
          'chris-watts-inside-the-mind-of-a-family-annihilator-and-the-depth-of-betrayal'
        ],
        styleVariant: 'full-bleed-gold',
        maxVisibleEpisodes: 3
      },
      {
        id: 'kidnappings-missing-persons-unsolved-cases',
        title: 'Unsolved Cases & Disappearances',
        intro: 'Missing persons, unexplained disappearances, and cases that still resist answers.',
        chipLabel: 'Kidnappings & Missing Persons',
        minimumEpisodesToRender: 3,
        episodeSlugs: [
          'chowchilla-bus-kidnapping-the-day-a-school-bus-vanished',
          'elizabeth-smart-kidnapped-by-a-prophet',
          'body-in-room-348-how-a-locked-room-led-to-an-impossible-answer',
          'jennifer-fairgate-the-woman-with-no-past'
        ],
        styleVariant: 'full-bleed-gold',
        maxVisibleEpisodes: 3
      },
      {
        id: 'scams-cover-ups-corporate-villainy',
        title: 'Scams, Frauds & Cover-Ups',
        intro: 'Fraud, deception, abuse of power, and the stories where greed or protection warped the truth.',
        chipLabel: 'Scams & Cover-Ups',
        minimumEpisodesToRender: 3,
        episodeSlugs: [
          'elizabeth-holmes-silicon-valley-s-greatest-fraud',
          'rudy-kurniawan-the-man-who-duped-the-elite-with-fake-fine-wines',
          'knoedler-gallery-scandal-the-greatest-art-fraud-of-the-century',
          'dr-donald-cline-conceived-in-deceit-the-infamous-fertility-scandal'
        ],
        styleVariant: 'full-bleed-gold',
        maxVisibleEpisodes: 3
      }
    ]
  }
};
