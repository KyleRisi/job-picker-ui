import type { Metadata } from 'next';

type RobotsDirective = NonNullable<Metadata['robots']>;

export const ROBOTS_NOINDEX_NOFOLLOW: RobotsDirective = {
  index: false,
  follow: false,
  googleBot: {
    index: false,
    follow: false
  }
};

export const ROBOTS_NOINDEX_FOLLOW: RobotsDirective = {
  index: false,
  follow: true,
  googleBot: {
    index: false,
    follow: true
  }
};
