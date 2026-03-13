import { listProperties } from '../gsc-client.mjs';

export async function runListPropertiesCommand() {
  const properties = await listProperties();

  if (!properties.length) {
    console.log('No Search Console properties found for this account.');
    return;
  }

  console.log('Search Console properties:');
  properties.forEach((property, index) => {
    const permission = property.permissionLevel || 'unknown';
    console.log(`${index + 1}. ${property.siteUrl} (${permission})`);
  });
}
