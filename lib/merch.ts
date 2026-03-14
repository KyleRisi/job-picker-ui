export type MerchProduct = {
  slug: string;
  name: string;
  shortName: string;
  priceLabel: string;
  badge: string;
  imageSrc: string;
  imageAlt: string;
  briefDescription: string;
  longDescription: string;
  featureList: string[];
};

const merchProducts: MerchProduct[] = [
  {
    slug: 'crotch-dangler',
    name: 'Official Compendium Keychain (Crotch Dangler)',
    shortName: 'Crotch Dangler',
    priceLabel: '£10.00',
    badge: 'First Drop',
    imageSrc: '/Keychain.png',
    imageAlt: 'The official Compendium Crotch Dangler keychain',
    briefDescription:
      'Official Compendium keychain with circus-grade branding. Ships worldwide with shipping included in the listed price.',
    longDescription:
      'A gloriously unnecessary, proudly unhinged Compendium Crotch Dangler Keychain with circus-grade branding included. Ships immediately with no waiting, no forms, and no fuss.',
    featureList: [
      'Ships immediately (no waiting)',
      'Official Compendium keychain',
      'Perfect for keys, bags, and gifts',
      'Maximum jingle potential'
    ]
  }
];

export function getMerchProducts(): MerchProduct[] {
  return merchProducts;
}

export function getMerchProductBySlug(slug: string): MerchProduct | null {
  return merchProducts.find((product) => product.slug === slug) ?? null;
}
