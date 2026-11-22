/**
 * The curated café list — Kirkland + Bellevue, WA.
 *
 * Source corpus: "Ask the barista" (ADR 0020), sourced 2026-11-12, verified by
 * Hojin on 2026-11-12. Facts are paraphrased only from these guide pages:
 *   mce-kirkland              https://mycoffeeexplorer.com/guides/kirkland-wa
 *   coffeeplume-kirkland      https://coffeeplume.com/coffee-shops-in-kirkland-wa/
 *   mce-bellevue              https://mycoffeeexplorer.com/guides/bellevue-wa
 *   downtownbellevue          https://downtownbellevue.com/living/coffee-shops/
 *   bellevuedowntown-tea      https://www.bellevuedowntown.com/post/meet-me-downtown-for-tea-flavor-and-craft
 *   bellevuecollection-chicha https://bellevuecollection.com/tenant/chicha-san-chen/
 *
 * Mapping rules (see PLAN.md):
 * - ids, names, addresses and neighborhoods are copied from the source.
 * - tags only where the source's drinks/vibe clearly say it, no inference:
 *     wifi ← "Wi-Fi" / "laptop-friendly"        outdoor ← "patio"
 *     late ← "open late" (not "into the evening") spacious ← "roomy"
 *     pastries ← pastries/croissants/scones/bakery food ← sandwiches/breakfast/toast/"food served"/"light meals"
 *     specialty-coffee ← the word "specialty" only  tea ← "tea" or a named tea (oolong, Thai tea…)
 *     matcha ← "matcha"                           desserts ← "desserts"/soft serve/parfait
 *   Noise only where it says "calm" (quiet) or "busy" (lively).
 * - blurbs are written only from the source's notableDrinks + vibe.
 * - TODO verify: the source has NO prices, hours or map links, so priceLevel,
 *   hours and mapsUrl are omitted (never invented). Add them only from a source.
 *
 * Excluded: caffe-ladro-kirkland (sources disagree on the address: 400 Urban
 * Plaza vs 104 Central Way). The corpus also removed Alanya Cafe and Beach
 * Cafe at the Point (could not be confirmed).
 *
 * Keep ids stable once rooms reference them.
 */

import type { Cafe } from '../domain'

export const CAFES: readonly Cafe[] = [
  // ---- Kirkland ------------------------------------------------------------
  {
    id: 'zoka-kirkland', // mce-kirkland
    name: 'Zoka Coffee Roaster & Tea Company',
    neighborhood: 'Downtown Kirkland',
    address: '129 Central Way, Kirkland, WA 98033',
    tags: ['wifi', 'tea'],
    blurb: 'House-roasted espresso, hand-brewed coffee and tea. Laptop-friendly, with large windows, near Marina Park.',
  },
  {
    id: 'thruline-kirkland', // mce-kirkland, coffeeplume-kirkland
    name: 'Thruline Coffee Co.',
    neighborhood: 'Downtown Kirkland (Park Lane)',
    address: '136 Park Ln, Kirkland, WA 98033',
    tags: ['wifi', 'tea'],
    blurb: 'Espresso drinks, cortados, single-origin drip, chai and tea, roasted on-site. Laid-back and good for studying, with Wi-Fi.',
  },
  {
    id: 'five-stones-kirkland', // mce-kirkland
    name: 'Five Stones Coffee Company (Kirkland)',
    neighborhood: 'Downtown Kirkland',
    address: '312 Central Way, Kirkland, WA 98033',
    tags: ['pastries', 'food'],
    blurb: 'Espresso drinks, pastries and breakfast, with seating downtown.',
  },
  {
    id: 'art-of-coffee-kirkland', // mce-kirkland
    name: 'The Art of Coffee',
    neighborhood: 'Downtown Kirkland (Lake Street)',
    address: '104 Lake St S, Kirkland, WA 98033',
    tags: [],
    blurb: 'Espresso drinks at a small shop. A quick stop before a waterfront walk.',
  },
  {
    id: '203f-kirkland', // mce-kirkland
    name: '203°F Coffee',
    neighborhood: 'Totem Lake',
    address: '11901 NE Village Plaza, Suite 171, Kirkland, WA 98034',
    tags: ['specialty-coffee', 'tea', 'matcha'],
    blurb: 'Specialty espresso drinks, matcha and tea, in Totem Lake Village.',
  },
  {
    id: 'mercurys-totem-lake', // mce-kirkland
    name: 'Mercurys Coffee Co. (Totem Lake)',
    neighborhood: 'Totem Lake',
    address: '12545 Totem Lake Blvd NE, Kirkland, WA 98034',
    tags: ['food'],
    blurb: 'Organic coffee: espresso drinks, cold brew, smoothies and breakfast sandwiches. Sit-down seating plus a drive-thru.',
  },
  {
    id: 'urban-coffee-lounge-juanita', // mce-kirkland
    name: 'Urban COFFEE Lounge',
    neighborhood: 'Juanita',
    address: '9744 NE 119th Way, Kirkland, WA 98034',
    tags: ['outdoor', 'pastries', 'food'],
    blurb: 'Espresso drinks with house-made syrups, plus pastries and sandwiches. A large patio by a fountain courtyard.',
  },
  {
    id: 'kitanda-kirkland', // coffeeplume-kirkland
    name: 'Kitanda Co',
    neighborhood: 'Kirkland (NE 124th St)',
    address: '12700 NE 124th St, Ste 2, Kirkland, WA 98034',
    tags: ['wifi'],
    blurb: 'Espresso, iced mocha, Brazilian cheese bread and acai bowls. Bright and casual with plenty of seating, and good for studying with Wi-Fi.',
  },
  {
    id: 'lilac-kirkland', // coffeeplume-kirkland
    name: 'Lilac Cafe',
    neighborhood: 'Downtown Kirkland',
    address: '212 Central Way, Kirkland, WA 98033',
    tags: ['pastries'],
    blurb: 'Cappuccino, croissants and a breakfast tart. Sunny, with a mix of lively tables and quiet nooks.',
  },

  // ---- Bellevue ------------------------------------------------------------
  {
    id: 'third-culture-bellevue', // mce-bellevue, downtownbellevue
    name: 'Third Culture Coffee',
    neighborhood: 'Old Bellevue',
    address: '80 102nd Ave NE, Bellevue, WA',
    tags: ['wifi', 'matcha'],
    blurb: 'Indian filter coffee, elaichi chai, rose matcha latte, Vietnamese drip coffee and lassi. Free Wi-Fi, a community table and evening events, across from Downtown Park.',
  },
  {
    id: 'dote-bellevue', // mce-bellevue, downtownbellevue
    name: 'Dote Coffee Bar',
    neighborhood: 'Lincoln Square / Bellevue Collection',
    address: '500 Bellevue Way NE, 2nd Floor, Bellevue, WA',
    tags: [],
    blurb: 'Honey dark mocha, turmeric ginger latte and espresso over ice cream. Chocolate-focused, roasts its own beans, and open into the evening.',
  },
  {
    id: 'story-coffee-tea-bellevue', // mce-bellevue, downtownbellevue
    name: 'Story Coffee & Tea',
    neighborhood: 'Downtown Bellevue',
    address: '11011 NE 9th St, Ste B, Bellevue, WA',
    tags: ['wifi', 'spacious', 'pastries', 'specialty-coffee', 'tea', 'desserts'],
    blurb: 'Specialty coffee, tea, pastries and desserts. A roomy, laptop-friendly study favorite that hosts live performances.',
  },
  {
    id: 'cafe-hagen-bellevue', // mce-bellevue, downtownbellevue
    name: 'Café Hagen',
    neighborhood: 'Downtown Bellevue',
    address: '777 108th Ave NE, Bellevue, WA',
    tags: ['pastries'],
    blurb: 'Lattes and Scandinavian pastries. Open into the evening on weekdays.',
  },
  {
    id: 'woods-lincoln-square', // mce-bellevue, downtownbellevue
    name: 'The Woods Coffee (Lincoln Square)',
    neighborhood: 'Lincoln Square / Bellevue Collection',
    address: '700 Bellevue Way NE, Ste 140, Bellevue, WA',
    tags: ['wifi', 'food'],
    blurb: 'House blends, single-origin coffee and breakfast croissant sandwiches. Free Wi-Fi and a reservable meeting room.',
  },
  {
    id: 'bellden-bellevue', // mce-bellevue, downtownbellevue
    name: 'Bellden Cafe',
    neighborhood: 'Old Bellevue',
    address: '10527 Main St, Bellevue, WA',
    tags: ['outdoor', 'food', 'matcha'],
    blurb: 'Lattes, matcha, seasonal lattes and avocado toast. A social enterprise with plants and a patio.',
  },
  {
    id: 'semicolon-bellevue', // mce-bellevue, downtownbellevue
    name: 'Semicolon Cafe',
    neighborhood: 'Old Bellevue',
    address: '10451 NE 2nd St, Bellevue, WA',
    tags: ['food', 'matcha', 'desserts'],
    blurb: 'Lattes, matcha, brioche sandwiches and desserts in a minimalist space.',
  },
  {
    id: 'sconers-bellevue', // mce-bellevue, downtownbellevue
    name: 'Sconers',
    neighborhood: 'Old Bellevue',
    address: '10000 Main St, Ste 103, Bellevue, WA',
    tags: ['pastries', 'tea'],
    blurb: 'Cream-top lattes, coffee, tea and buttermilk scones. Family-run and compact.',
  },
  {
    id: 'cafe-joy-bellevue', // mce-bellevue
    name: 'Cafe Joy',
    neighborhood: 'Downtown Bellevue (near the library)',
    address: '11004 NE 11th St, Ste 108, Bellevue, WA',
    tags: ['pastries'],
    blurb: 'Black sesame and sweet corn lattes, smoothies and croffles at a Korean café and bakery.',
  },
  {
    id: 'diwan-bellevue', // mce-bellevue
    name: 'Diwan Coffee House',
    neighborhood: 'Spring District / Wilburton',
    address: '12288 NE District Way, Ste 125, Bellevue, WA',
    tags: ['specialty-coffee', 'pastries', 'matcha'],
    noise: 'quiet', // source: "calm"
    blurb: 'A calm spot for specialty lattes, matcha, Middle Eastern-inspired drinks and pastries.',
  },
  {
    id: 'five-stones-bellevue-college', // mce-bellevue
    name: 'Five Stones Coffee Company (Bellevue College)',
    neighborhood: 'Bellevue College',
    address: '2649 Landerholm Cir SE, Bellevue, WA',
    tags: ['pastries', 'food'],
    noise: 'quiet', // source: "calm seating"
    blurb: 'Coffee, seasonal drinks, toast and pastries. Bright, with calm seating near campus.',
  },
  {
    id: 'last-frontier-eastgate', // mce-bellevue
    name: 'Last Frontier Coffee',
    neighborhood: 'Eastgate',
    address: '3080 148th Ave SE, Ste 113, Bellevue, WA',
    tags: ['food', 'matcha'],
    blurb: 'Espresso, pour-over, cold brew, matcha and seasonal specials. A neighborhood café that also serves food.',
  },
  {
    id: 'copper-kettle-botanical', // mce-bellevue
    name: 'Copper Kettle Coffee Bar',
    neighborhood: 'Bellevue Botanical Garden',
    address: '12001 Main St, Bellevue, WA (Bellevue Botanical Garden)',
    tags: ['pastries', 'food', 'tea'],
    blurb: 'Organic fair-trade coffee, tea, pastries and sandwiches, with garden views.',
  },
  {
    id: 'nanas-green-tea-bellevue', // downtownbellevue, bellevuedowntown-tea
    name: "Nana's Green Tea",
    neighborhood: 'Old Bellevue',
    address: '16 103rd Ave NE, Bellevue, WA',
    tags: ['food', 'matcha', 'desserts'],
    blurb: 'Matcha lattes, matcha parfaits, matcha soft serve and warabimochi. A Japanese café that also serves light meals.',
  },
  {
    id: 'molly-tea-bellevue', // downtownbellevue, bellevuedowntown-tea
    name: 'Molly Tea',
    neighborhood: 'Downtown Bellevue',
    address: '103 Bellevue Way NE, #2, Bellevue, WA',
    tags: ['late', 'tea'],
    blurb: 'Jasmine milk tea, floral milk teas and jasmine mango coconut tea. A tea shop that’s open late.',
  },
  {
    id: 'heytea-bellevue', // downtownbellevue, bellevuedowntown-tea
    name: 'HEYTEA',
    neighborhood: 'Downtown Bellevue',
    address: '700 110th Ave NE, Ste 192 (The Bravern), Bellevue, WA',
    tags: ['late', 'tea'],
    blurb: 'Cheese foam teas, including jasmine with cheese foam, and fruit teas. Open late, with lines on weekends.',
  },
  {
    id: 'chicha-san-chen-bellevue', // downtownbellevue, bellevuecollection-chicha
    name: 'CHICHA San Chen',
    neighborhood: 'Bellevue Square',
    address: '188 Bellevue Square, Level 1, Bellevue, WA',
    tags: ['tea'],
    blurb: 'Whole-leaf Taiwanese tea, Dong Ding oolong lattes and milk tea at a mall tea counter.',
  },
  {
    id: 'ug-tea-bellevue', // downtownbellevue, bellevuedowntown-tea
    name: 'UG Tea',
    neighborhood: 'Downtown Bellevue',
    address: '308 105th Ave NE, Bellevue, WA',
    tags: ['late', 'tea', 'matcha'],
    blurb: 'Matcha, osmanthus oolong, jasmine espresso and a matcha cookie smoothie. Open late, with a photo booth.',
  },
  {
    id: 'omo-thai-tea-bellevue', // downtownbellevue, bellevuedowntown-tea
    name: 'OMO Thai Tea',
    neighborhood: 'Downtown Bellevue',
    address: '10226 NE 10th St, Bellevue, WA',
    tags: ['tea', 'desserts'],
    blurb: 'Thai tea, ube Thai tea floats and Thai tea soft serve: dessert-style tea drinks.',
  },
]

export const CAFES_BY_ID: ReadonlyMap<string, Cafe> = new Map(CAFES.map((c) => [c.id, c]))
