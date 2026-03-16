import type { TopicHubConfig } from '@/lib/topic-hub/topic-hub-types';

export const TRUE_CRIME_TOPIC_HUB_CONFIG: TopicHubConfig = {
  slug: 'true-crime',
  seoOverride: {
    titleAbsolute: 'True Crime Podcast Episodes | Murders, Disappearances & Scandals | The Compendium Podcast',
    description:
      'Explore the best true crime podcast episodes from The Compendium, including murders, kidnappings, frauds, disappearances, cover-ups, and unsolved cases.'
  },
  layout: {
    hero: {
      eyebrow: 'Curated Listening Guide',
      title: 'True Crime Episodes',
      intro:
        "Explore The Compendium's standout true crime episodes, from murders and missing persons to scams, disappearances, and unsolved cases. Start with our strongest entry-point episodes, then browse by case type or move straight into the full archive.",
      primaryAction: {
        label: 'Start Here',
        href: '#start-here'
      },
      secondaryAction: {
        label: 'Browse all true crime episodes',
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
      heading: '3 Essential True Crime Episodes for New Listeners',
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
      eyebrow: 'Why Listen',
      heading: 'Why listen to our true crime episodes?',
      intro:
        'At The Compendium, we take the facts seriously, even if the delivery occasionally sounds like two people filing an incident report from inside a travelling circus. We focus on what happened, who it affected, and why the case still matters, then tell the story clearly enough that you do not need a pinboard, red string, or a second podcast to keep up.',
      points: [
        'Clear chronology, without the fog machine',
        'Real context, not just the grisly bits',
        'Conversational storytelling, with the facts intact'
      ]
    },
    faq: {
      eyebrow: 'FAQ',
      heading: 'Frequently Asked Questions',
      supportingLine: 'Helpful answers for first-time listeners',
      items: [
        {
          question: 'What are the best true crime episodes to start with?',
          answer:
            "Start with the featured episodes at the top of this page. They're our best first port of call if you'd like the full Compendium experience without immediately needing a corkboard."
        },
        {
          question: 'Do you cover British true crime cases?',
          answer:
            'Yes. We cover both British and international cases, from investigations and disappearances to frauds, scandals, and major media-covered crimes.'
        },
        {
          question: 'Are these episodes serious or comedic?',
          answer:
            'The facts are taken seriously. The delivery is conversational, which makes the stories easier to follow without turning the whole affair into an audition for bleakness.'
        },
        {
          question: 'What should I listen to after this page?',
          answer:
            "If you'd like more cases, head to the full true crime archive. If you're in the mood for neighbouring oddities, move sideways into History, Mysteries & The Unexplained, or Incredible People."
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
          description: 'For real events, power struggles, and the context around the stories that shaped the world.',
          label: 'Topic Page',
          ctaLabel: 'Explore topic'
        },
        {
          href: '/topics/mysteries-unexplained',
          title: 'Mysteries & The Unexplained',
          description: 'For unresolved stories, strange disappearances, and the questions that refuse to settle.',
          label: 'Topic Page',
          ctaLabel: 'Explore topic'
        },
        {
          href: '/topics/incredible-people',
          title: 'Incredible People',
          description: 'For lives that veered into obsession, scandal, notoriety, and extraordinary consequences.',
          label: 'Topic Page',
          ctaLabel: 'Explore topic'
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
        maxVisibleEpisodes: 4,
        taxonomyCollectionSlug: 'british-cases'
      },
      {
        id: 'murders-serial-killers-notorious-cases',
        title: 'Murders, Serial Killers & Notorious Cases',
        intro: 'Cases defined by violence, notoriety, and the long trail they leave behind.',
        chipLabel: 'Murders',
        minimumEpisodesToRender: 3,
        episodeSlugs: [
          'hillside-strangler-murder-in-the-shadows-of-los-angeles',
          'chaos-charles-manson-and-the-manson-murders',
          'monster-of-florence-the-real-life-horror-behind-an-italian-legend',
          'chris-watts-inside-the-mind-of-a-family-annihilator-and-the-depth-of-betrayal'
        ],
        styleVariant: 'plain',
        maxVisibleEpisodes: 3
      },
      {
        id: 'kidnappings-missing-persons-unsolved-cases',
        title: 'Kidnappings, Missing Persons & Unsolved Cases',
        intro: 'Abductions, disappearances, fractured investigations, and the stories that refused to stay buried.',
        chipLabel: 'Kidnappings & Missing Persons',
        minimumEpisodesToRender: 3,
        episodeSlugs: [
          'chowchilla-bus-kidnapping-the-day-a-school-bus-vanished',
          'elizabeth-smart-kidnapped-by-a-prophet',
          'body-in-room-348-how-a-locked-room-led-to-an-impossible-answer',
          'jennifer-fairgate-the-woman-with-no-past'
        ],
        styleVariant: 'mobile-full-bleed-panel',
        maxVisibleEpisodes: 3
      },
      {
        id: 'scams-cover-ups-corporate-villainy',
        title: 'Scams, Cover-Ups & Corporate Villainy',
        intro: 'Fraud, deception, institutional abuse, and the stories where greed or power warped everything around them.',
        chipLabel: 'Scams & Cover-Ups',
        minimumEpisodesToRender: 3,
        episodeSlugs: [
          'elizabeth-holmes-silicon-valley-s-greatest-fraud',
          'rudy-kurniawan-the-man-who-duped-the-elite-with-fake-fine-wines',
          'knoedler-gallery-scandal-the-greatest-art-fraud-of-the-century',
          'dr-donald-cline-conceived-in-deceit-the-infamous-fertility-scandal'
        ],
        styleVariant: 'plain',
        maxVisibleEpisodes: 3
      }
    ]
  }
};
