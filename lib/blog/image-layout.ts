export type BlogImageBlockSize = 'narrow' | 'wide' | 'full';

type ImageBlockLayout = {
  wrapperClassName: string;
  sizes: string;
};

const IMAGE_BLOCK_LAYOUTS: Record<BlogImageBlockSize, ImageBlockLayout> = {
  narrow: {
    wrapperClassName: 'mx-auto w-full max-w-2xl',
    sizes: '(max-width: 640px) 92vw, (max-width: 1024px) 82vw, 720px'
  },
  wide: {
    wrapperClassName: 'mx-auto w-full max-w-4xl',
    sizes: '(max-width: 640px) 96vw, (max-width: 1200px) 88vw, 1024px'
  },
  full: {
    wrapperClassName: 'w-full max-w-none',
    sizes: '(max-width: 1280px) 100vw, 1200px'
  }
};

export function getImageBlockLayout(size: string | null | undefined): ImageBlockLayout {
  if (size === 'narrow' || size === 'wide' || size === 'full') {
    return IMAGE_BLOCK_LAYOUTS[size];
  }
  return IMAGE_BLOCK_LAYOUTS.wide;
}
