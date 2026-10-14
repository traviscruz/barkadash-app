// Philippine Seasonal Spots Recommendation Service
// Detects the current season in the Philippines based on the active date,
// and curates top spots, seasonal reasons, activities, and local food trips.

export type PhilippineSeasonKey = 'summer' | 'monsoon' | 'ber_months' | 'amihan';

export type SpotCategory = 'all' | 'beach' | 'mountain' | 'heritage' | 'food' | 'cozy';

export interface PhilippineSpot {
  id: string;
  name: string;
  province: string;
  region: 'Luzon' | 'Visayas' | 'Mindanao';
  tagline: string;
  season: PhilippineSeasonKey;
  secondarySeason?: PhilippineSeasonKey;
  category: 'beach' | 'mountain' | 'heritage' | 'food' | 'cozy';
  whyNow: string;
  whyNowDetails: string;
  imageUrl: string;
  vibeTag: string;
  weatherTemp: string;
  bestMonths: string;
  budgetLevel: '₱' | '₱₱' | '₱₱₱';
  highlights: string[];
  mustTryBites: string[];
  travelTip: string;
}

export interface SeasonMeta {
  key: PhilippineSeasonKey;
  name: string;
  shortName: string;
  tagline: string;
  badge: string;
  iconName: 'sparkles' | 'wind' | 'sun' | 'cloud-rain';
  monthsLabel: string;
  monthsNumbers: number[]; // 0-indexed (0 = Jan, 11 = Dec)
  description: string;
  whyVisitNowSummary: string;
  gradientColors: [string, string];
  accentColor: string;
  accentBg: string;
}

export const PHILIPPINE_SEASONS: SeasonMeta[] = [
  {
    key: 'ber_months',
    name: 'Ber Months & Holiday Season',
    shortName: 'Ber Months',
    tagline: 'Paskong Pinoy Breezes & Highland Fog',
    badge: 'Crisp Chills & Festivities',
    iconName: 'sparkles',
    monthsLabel: 'Sep – Nov',
    monthsNumbers: [8, 9, 10], // Sep, Oct, Nov
    description: 'The legendary Filipino Christmas countdown begins! Cool mountain breezes start rolling in, giant lanterns light up, and highland getaways are at their coziest.',
    whyVisitNowSummary: 'Ideal for sweater-weather road trips, early holiday lights, flower farms, and vibrant food festivals before the peak holiday rush.',
    gradientColors: ['#B45309', '#D97706'],
    accentColor: '#D97706',
    accentBg: '#FEF3C7',
  },
  {
    key: 'amihan',
    name: 'Cool Amihan Season',
    shortName: 'Cool Amihan',
    tagline: 'Tag-lamig, Sweater Weather & Clear Blue Skies',
    badge: 'Sea of Clouds & Clear Skies',
    iconName: 'wind',
    monthsLabel: 'Dec – Feb',
    monthsNumbers: [11, 0, 1], // Dec, Jan, Feb
    description: 'Northeast monsoon winds bring the crispest, coldest air of the year to the Philippines with low humidity, blue skies, and textbook sea-of-clouds sunrises.',
    whyVisitNowSummary: 'Coldest temperatures of the year! Experience freezing morning treks in the Cordilleras, Panagbenga flower floats, and Sinulog festival.',
    gradientColors: ['#0284C7', '#0EA5E9'],
    accentColor: '#0284C7',
    accentBg: '#E0F2FE',
  },
  {
    key: 'summer',
    name: 'Summer Sunshine (Tag-araw)',
    shortName: 'Summer Peak',
    tagline: 'Peak Island Hopping & Glassy Turquoise Waters',
    badge: 'Peak Beach & Island Season',
    iconName: 'sun',
    monthsLabel: 'Mar – May',
    monthsNumbers: [2, 3, 4], // Mar, Apr, May
    description: 'The dry tropical summer is here! Calmer seas, sun-kissed islands, crystal-clear snorkeling visibility, and vibrant golden hour beach sunsets.',
    whyVisitNowSummary: 'Best time for island hopping, snorkeling with sea turtles, powdery white beaches, and sunset paraw sailing.',
    gradientColors: ['#EA580C', '#F59E0B'],
    accentColor: '#EA580C',
    accentBg: '#FFEDD5',
  },
  {
    key: 'monsoon',
    name: 'Cozy Monsoon (Tag-ulan)',
    shortName: 'Cozy Monsoon',
    tagline: 'Hot Springs, Misty Overlooks & Surf Swells',
    badge: 'Cozy Springs & Swell Season',
    iconName: 'cloud-rain',
    monthsLabel: 'Jun – Aug',
    monthsNumbers: [5, 6, 7], // Jun, Jul, Aug
    description: 'The Southwest monsoon (Habagat) transforms the country into a lush emerald playground with steaming hot springs, misty mountain retreats, and epic surf swells.',
    whyVisitNowSummary: 'Best time for soothing all-night hot spring soaks, steaming bowls of hot bulalo with rain overlooks, and catching monsoon surf breaks.',
    gradientColors: ['#047857', '#10B981'],
    accentColor: '#047857',
    accentBg: '#D1FAE5',
  },
];

export const PHILIPPINE_SPOTS: PhilippineSpot[] = [
  // ==========================================
  // BER MONTHS (September – November)
  // ==========================================
  {
    id: 'baguio_ber',
    name: 'Baguio City & Atok',
    province: 'Benguet',
    region: 'Luzon',
    tagline: 'Crisp Pine Morning Fog & Early Christmas Lights',
    season: 'ber_months',
    secondarySeason: 'amihan',
    category: 'mountain',
    whyNow: 'The Ber months bring Baguio’s iconic cold mornings, pine-scented breezes, and early Manor Christmas displays without the holiday rush.',
    whyNowDetails: 'October and November mark the start of chilly weather in the summer capital. Atok’s Northern Blossom flower farm is in full bloom, Camp John Hay feels delightfully brisk, and hot Tsokolate de Batirol tastes twice as good.',
    imageUrl: 'https://images.unsplash.com/photo-1518709268805-4e9042af9f23?auto=format&fit=crop&w=800&q=80',
    vibeTag: 'Sweater Weather',
    weatherTemp: '15°C – 21°C',
    bestMonths: 'Sep – Feb',
    budgetLevel: '₱₱',
    highlights: [
      'Camp John Hay pine trail strolls & hot Tsokolate de Batirol',
      'Atok Northern Blossom Flower Farm mountain panorama',
      'Night Market bargain hunting on Harrison Road',
      'Mirador Heritage Park peaceful torii gate sunset',
    ],
    mustTryBites: [
      'Warm Strawberry Taho with sweet syrup',
      'Baguio Country Club famous Raisin Bread',
      'Steaming mountain Pinikpikan with etag',
    ],
    travelTip: 'Pack your favorite oversized sweaters and beanies! Ber month evenings in Baguio easily dip below 16°C.',
  },
  {
    id: 'sagada_ber',
    name: 'Sagada',
    province: 'Mountain Province',
    region: 'Luzon',
    tagline: 'Sea of Clouds Sunrises & Bonfire Nights',
    season: 'ber_months',
    secondarySeason: 'amihan',
    category: 'mountain',
    whyNow: 'Crisp autumn-like chill and crystal-clear morning sunrises over rolling sea of clouds without peak summer crowds.',
    whyNowDetails: 'During October and November, rain eases up and cold mountain air settles into the valleys. Wake up at 4:30 AM to witness the legendary sea of clouds at Marlboro Hills, explore hanging coffins in the cool mist, and enjoy quiet cafe bonfires.',
    imageUrl: 'https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?auto=format&fit=crop&w=800&q=80',
    vibeTag: 'Sea of Clouds',
    weatherTemp: '13°C – 19°C',
    bestMonths: 'Oct – Feb',
    budgetLevel: '₱₱',
    highlights: [
      'Marlboro Hills sunrise above sea of clouds',
      'Echo Valley hanging coffins & forest walk',
      'Spelunking through Sumaguing Cave rock formations',
      'Bonfires under starry Cordillera skies',
    ],
    mustTryBites: [
      'Sagada Lemon Pie with toasted meringue',
      'Fresh drip Sagada Arabica mountain coffee',
      'Homemade strawberry yogurt bowls at Yoghurt House',
    ],
    travelTip: 'Bring sturdy trail shoes with strong grip for cave exploring and muddy sunrise treks.',
  },
  {
    id: 'tagaytay_ber',
    name: 'Tagaytay Ridge & Alfonso',
    province: 'Cavite',
    region: 'Luzon',
    tagline: 'Breezy Escapes & Steaming Bulalo Overlook',
    season: 'ber_months',
    secondarySeason: 'monsoon',
    category: 'cozy',
    whyNow: 'Brisk Ber-month winds sweep across Taal Lake, making a hot clay pot of bulalo the quintessential barkada road trip.',
    whyNowDetails: 'Just 1.5 hours from the metro, Tagaytay transitions into sweater weather in late September. Crisp panoramic ridge views, pine groves in Alfonso, and cozy cabin glamping make it the top low-friction barkada weekend escape.',
    imageUrl: 'https://images.unsplash.com/photo-1506744038136-46273834b3fb?auto=format&fit=crop&w=800&q=80',
    vibeTag: 'Road Trip & Bulalo',
    weatherTemp: '19°C – 25°C',
    bestMonths: 'Sep – Feb',
    budgetLevel: '₱₱',
    highlights: [
      'Mahogany Market hot bulalo row feast',
      'Panoramic lake overlooking at Picnic Grove & Sky Ranch',
      'Museo Orlina sculpture garden and rooftop view',
      'Cozy glamping cabins and bonfires in Alfonso',
    ],
    mustTryBites: [
      'Piping-hot bone marrow Bulalo soup',
      'Crispy fried Tawilis with spicy calamansi dip',
      'Freshly baked apple pie and bibingka',
    ],
    travelTip: 'Leave early on Saturday morning by 5:30 AM to dodge SLEX traffic and catch the morning mist over Taal.',
  },
  {
    id: 'bacolod_ber',
    name: 'Bacolod & Iloilo',
    province: 'Western Visayas',
    region: 'Visayas',
    tagline: 'MassKara Fiesta & Legendary Food Crawl',
    season: 'ber_months',
    category: 'food',
    whyNow: 'October is MassKara Festival season in the City of Smiles! Heritage mansions, giant electric float parades, and unparalleled Visayan seafood.',
    whyNowDetails: 'The Ber months are the grandest time to visit Negros Occidental and Iloilo. With pleasant breezes and fiesta fever, barkadas can dance along Lacson Street, visit The Ruins, and cross the Guimaras strait in under 15 minutes.',
    imageUrl: 'https://images.unsplash.com/photo-1544620347-c4fd4a3d5957?auto=format&fit=crop&w=800&q=80',
    vibeTag: 'MassKara Fiesta & Bites',
    weatherTemp: '24°C – 29°C',
    bestMonths: 'Sep – Dec',
    budgetLevel: '₱₱',
    highlights: [
      'MassKara street dancing & glowing electric floats',
      'The Ruins ancestral mansion sunset tour in Talisay',
      'Iloilo River Esplanade evening stroll & Calle Real',
      'Historic Miag-ao Church UNESCO heritage visit',
    ],
    mustTryBites: [
      'Authentic Chicken Inasal at Manokan Country',
      'Steaming La Paz Batchoy with bone marrow & extra chicharon',
      'Calea chocolate mud pie & Napoleones pastries',
    ],
    travelTip: 'Book flights and hotels early if visiting during the 3rd or 4th week of October for the MassKara grand weekend.',
  },
  {
    id: 'batanes_ber',
    name: 'Batanes (Basco & Sabtang)',
    province: 'Batanes',
    region: 'Luzon',
    tagline: 'Dramatic Emerald Cliffs & Ocean Swells',
    season: 'ber_months',
    secondarySeason: 'amihan',
    category: 'mountain',
    whyNow: 'Autumn-like breezes roll over Marlboro Hills with golden grass transitions, mild cool sunshine, and fewer tourists.',
    whyNowDetails: 'September through November brings an otherworldly serenity to the northernmost archipelago. The weather is cool enough for long walks along basalt shorelines, bicycling through Basco, and visiting Ivatan stone villages.',
    imageUrl: 'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&w=800&q=80',
    vibeTag: 'Wild Emerald Escapes',
    weatherTemp: '19°C – 25°C',
    bestMonths: 'Oct – Mar',
    budgetLevel: '₱₱₱',
    highlights: [
      'Racuh A Payaman (Marlboro Hills) rolling cliffs',
      'Basco Lighthouse sunset panoramic view',
      'Traditional Ivatan stone houses of Chavayan village',
      'Valugan Boulder Beach crashing ocean waves',
    ],
    mustTryBites: [
      'Luñis (authentic Ivatan pork adobo cooked in its own fat)',
      'Uvud balls with yellow turmeric ginger rice',
      'Fresh grilled pacific lobster',
    ],
    travelTip: 'Bring a windbreaker jacket! Coastal gusts on the cliffs can get strong and pleasantly brisk.',
  },
  {
    id: 'pampanga_ber',
    name: 'San Fernando & Angeles',
    province: 'Pampanga',
    region: 'Luzon',
    tagline: 'Christmas Capital of the Philippines & Sisig Crawl',
    season: 'ber_months',
    category: 'heritage',
    whyNow: 'San Fernando lights up its world-famous giant handmade Parol lanterns in September, paired with the best culinary food crawl in Luzon.',
    whyNowDetails: 'Filipino Christmas starts early in Pampanga! Barkadas can witness lantern artisans at work, feast on authentic sizzling sisig where it was invented, and explore historic heritage churches and Clark weekend parks.',
    imageUrl: 'https://images.unsplash.com/photo-1512389142860-9c449e58a543?auto=format&fit=crop&w=800&q=80',
    vibeTag: 'Parol & Sisig Haven',
    weatherTemp: '24°C – 30°C',
    bestMonths: 'Sep – Dec',
    budgetLevel: '₱',
    highlights: [
      'Giant Lantern craft workshop tours and dazzling night displays',
      'Clark Freeport park picnics and cafe strips',
      'Heritage houses of San Fernando and Holy Rosary Parish',
      'Epic street food night crawl at Crossing',
    ],
    mustTryBites: [
      'Original Aling Lucing sizzling pork Sisig',
      'Authentic Kapampangan Pancit Palabok',
      'Tibok-tibok (sweet creamy carabao milk pudding)',
    ],
    travelTip: 'Take the Skyway Stage 3 and NLEX for a swift 1-hour road trip from Quezon City.',
  },

  // ==========================================
  // AMIHAN SEASON (December – February)
  // ==========================================
  {
    id: 'pulag_amihan',
    name: 'Mt. Pulag & Kabayan',
    province: 'Benguet',
    region: 'Luzon',
    tagline: 'Sub-Zero Mornings & The Playground of the Gods',
    season: 'amihan',
    category: 'mountain',
    whyNow: 'Peak Amihan season! Temperatures plummet below 10°C, producing the most magnificent sea-of-clouds sunrises above dwarf bamboo slopes.',
    whyNowDetails: 'December through February is the golden season for hiking Mt. Pulag. The cold Northeast monsoon drives away humidity and heavy rains, leaving clear starlit night skies and stunning morning cloud inversions at Tower Peak.',
    imageUrl: 'https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?auto=format&fit=crop&w=800&q=80',
    vibeTag: 'Frost & Sea of Clouds',
    weatherTemp: '8°C – 16°C',
    bestMonths: 'Dec – Feb',
    budgetLevel: '₱₱',
    highlights: [
      'Sunrise over the legendary sea of clouds at Peak 3',
      'Trek through the fairytale-like Mossy Forest',
      'Stargazing under the Milky Way at Camp 2',
      'Warm homestay gatherings with Benguet Arabica coffee',
    ],
    mustTryBites: [
      'Benguet Highland Arabica hot drip coffee',
      'Pinikpikan with etag and wild mountain vegetables',
      'Warm sticky rice cakes with coconut latik',
    ],
    travelTip: 'Layer up with thermal innerwear, a fleece jacket, windbreaker, and thermal gloves. Night temperatures can freeze!',
  },
  {
    id: 'baguio_amihan',
    name: 'Baguio City & La Trinidad',
    province: 'Benguet',
    region: 'Luzon',
    tagline: 'Panagbenga Flower Fest & Sweet Strawberry Picking',
    season: 'amihan',
    category: 'mountain',
    whyNow: 'The coolest weather of the entire year! Peak strawberry harvest in La Trinidad and the world-famous Panagbenga flower float festival in February.',
    whyNowDetails: 'With temperatures hovering between 12°C and 18°C, Baguio in January and February is in its element. Put on your thickest trench coats, paddle swan boats through misty Burnham Park, and hand-pick sweet giant strawberries in the farm fields.',
    imageUrl: 'https://images.unsplash.com/photo-1518709268805-4e9042af9f23?auto=format&fit=crop&w=800&q=80',
    vibeTag: 'Panagbenga & Strawberries',
    weatherTemp: '12°C – 19°C',
    bestMonths: 'Dec – Feb',
    budgetLevel: '₱₱',
    highlights: [
      'Hand-picking sweet fresh strawberries at La Trinidad farms',
      'Panagbenga grand floral float parade along Session Road',
      'Morning fog walks under Camp John Hay pine trees',
      'Burnham Park bicycle rentals and swan boat paddling',
    ],
    mustTryBites: [
      'Warm fresh strawberry taho with fresh boba',
      'Good Shepherd authentic purple ube jam',
      'Garlicky Baguio longganisa with fried rice',
    ],
    travelTip: 'Visit strawberry farms at 7:00 AM to pick the ripest berries before the afternoon heat and buses arrive.',
  },
  {
    id: 'cebu_bohol_amihan',
    name: 'Cebu & Bohol',
    province: 'Central Visayas',
    region: 'Visayas',
    tagline: 'Sinulog Festival, Chocolate Hills & Canyoneering',
    season: 'amihan',
    secondarySeason: 'summer',
    category: 'heritage',
    whyNow: 'January lights up with Sinulog, the grandest fiesta in the Philippines! Amihan dry weather is also optimal for Kawasan Falls canyoneering and Bohol tours.',
    whyNowDetails: 'The cool dry winds make exploring Bohol’s Chocolate Hills, cruising Loboc River, and cliff-jumping into turquoise Kawasan Falls comfortable without summer scorch. Plus, Cebu City hosts world-class concerts and street parades.',
    imageUrl: 'https://images.unsplash.com/photo-1518509562904-e7ef99cdcc86?auto=format&fit=crop&w=800&q=80',
    vibeTag: 'Sinulog Fiesta & Canyons',
    weatherTemp: '23°C – 28°C',
    bestMonths: 'Dec – Mar',
    budgetLevel: '₱₱',
    highlights: [
      'Sinulog grand street parade and cultural concerts in Cebu',
      'Kawasan canyoneering adventure and cliff jumps',
      'Chocolate Hills ATV adventure ride in Carmen, Bohol',
      'Snorkeling with sea turtles at Balicasag Island marine sanctuary',
    ],
    mustTryBites: [
      'Crispy skin Cebu Lechon seasoned with lemongrass',
      'Puso (hanging rice) with spicy tuslob buwa gravy',
      'Fresh Bohol Bee Farm organic honey ice cream',
    ],
    travelTip: 'Fastcraft ferries take just 2 hours between Cebu Pier 1 and Tagbilaran Bohol, making a twin-island trip seamless.',
  },
  {
    id: 'vigan_amihan',
    name: 'Vigan & Pagudpud',
    province: 'Ilocos',
    region: 'Luzon',
    tagline: 'Cobblestone Heritage Nights & Coastal Windmills',
    season: 'amihan',
    category: 'heritage',
    whyNow: 'Amihan brings refreshing coastal breezes to Northern Luzon, making walking along Calle Crisologo and sand dune rides comfortable.',
    whyNowDetails: 'Summer in Ilocos can reach 38°C, but December to February brings pleasant, balmy 25°C weather. Explore UNESCO World Heritage sites, take nighttime kalesa rides on cobblestone streets, and snap photos by the giant Bangui windmills.',
    imageUrl: 'https://images.unsplash.com/photo-1544620347-c4fd4a3d5957?auto=format&fit=crop&w=800&q=80',
    vibeTag: 'Heritage Cobblestones',
    weatherTemp: '21°C – 27°C',
    bestMonths: 'Dec – Feb',
    budgetLevel: '₱₱',
    highlights: [
      'Calle Crisologo evening kalesa ride under vintage streetlamps',
      'Bangui Windmills coastline photography session',
      'Paoay Sand Dunes 4x4 thrilling safari & sandboarding',
      'Historic UNESCO World Heritage Paoay Church visit',
    ],
    mustTryBites: [
      'Crunchy Vigan empanada with egg and garlicky longganisa',
      'Crispy golden Bagnet with spicy sukang Iloko dip',
      'Cheesy warm Royal Bibingka',
    ],
    travelTip: 'Visit Calle Crisologo right at dusk when old warm streetlamps switch on and day-tripper crowds subside.',
  },

  // ==========================================
  // SUMMER SEASON (March – May)
  // ==========================================
  {
    id: 'palawan_summer',
    name: 'El Nido & Coron',
    province: 'Palawan',
    region: 'Luzon',
    tagline: 'Mirror-Calm Turquoise Lagoons & Limestone Cliffs',
    season: 'summer',
    category: 'beach',
    whyNow: 'Peak summer guarantees glassy sea conditions, unmatched water clarity for snorkeling, and sunny blue skies every single day.',
    whyNowDetails: 'March to May is the world-renowned high season for Palawan. Kayak inside the Big Lagoon with mirror-calm turquoise water, snorkel colorful WWII shipwrecks in Coron, and watch fiery sunsets over Nacpan Beach.',
    imageUrl: 'https://images.unsplash.com/photo-1518509562904-e7ef99cdcc86?auto=format&fit=crop&w=800&q=80',
    vibeTag: 'Lagoon Paradise',
    weatherTemp: '26°C – 33°C',
    bestMonths: 'Mar – May',
    budgetLevel: '₱₱₱',
    highlights: [
      'Kayaking inside the Big Lagoon turquoise gateway',
      'Swimming in Kayangan Lake & Twin Lagoon in Coron',
      'Nacpan Beach coconut palm stroll & sunset chill',
      'Snorkeling Japanese shipwrecks and coral gardens',
    ],
    mustTryBites: [
      'Grilled seafood boodle fight right on the boat',
      'Fresh coconut water straight from tree',
      'Coron roasted garlic cashews',
    ],
    travelTip: 'Book Tour A in El Nido or the Super Ultimate Tour in Coron early in the morning to beat the midday tour boats.',
  },
  {
    id: 'boracay_summer',
    name: 'Boracay Island',
    province: 'Aklan',
    region: 'Visayas',
    tagline: 'Powdery White Sands & World-Famous Sunsets',
    season: 'summer',
    category: 'beach',
    whyNow: 'Amihan winds fade and Habagat hasn’t arrived, making White Beach calm like a swimming pool with the smoothest golden sunsets.',
    whyNowDetails: 'Summer is the peak season when Boracay’s 4-kilometer powdery white sand is at its absolute clearest and finest. Hop on a wooden paraw sailboat as the sun dips below the horizon, try paddleboarding at Station 1, and enjoy acoustic beach lounges.',
    imageUrl: 'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&w=800&q=80',
    vibeTag: 'White Sand & Sunsets',
    weatherTemp: '27°C – 33°C',
    bestMonths: 'Mar – May',
    budgetLevel: '₱₱',
    highlights: [
      'Paraw sailing at golden hour into the open sea',
      'Paddleboarding across mirror-flat Station 1 shallows',
      'Puka Shell Beach scooter road trip for shell hunting',
      'Live acoustic sessions and fire dancers by the shore',
    ],
    mustTryBites: [
      'Chori Burger with sweet spicy glaze on toasted bun',
      'Jonah’s famous Mango Milkshake',
      'Fresh Calamansi Muffins from Real Coffee',
    ],
    travelTip: 'Walk down to Station 1 near Willy’s Rock between 5:15 PM and 5:45 PM for the most breathtaking sunset photos.',
  },
  {
    id: 'siargao_summer',
    name: 'Siargao Island',
    province: 'Surigao del Norte',
    region: 'Mindanao',
    tagline: 'Tidal Rock Pools, Palm Trees & Island Hopping',
    season: 'summer',
    category: 'beach',
    whyNow: 'Calm summer tides make Magpupungko Rock Pools crystal-clear and safe for swimming, with easy island hopping to Guyam and Daku.',
    whyNowDetails: 'While autumn brings big surf swells, summer offers idyllic calm island life. Drive motorbikes along endless coconut tree roads, dive into turquoise Sugba Lagoon, and feast on fresh tuna kinilaw under tropical palms.',
    imageUrl: 'https://images.unsplash.com/photo-1506744038136-46273834b3fb?auto=format&fit=crop&w=800&q=80',
    vibeTag: 'Island Life & Rock Pools',
    weatherTemp: '26°C – 32°C',
    bestMonths: 'Mar – Jun',
    budgetLevel: '₱₱',
    highlights: [
      'Magpupungko natural rock pool swimming at low tide',
      'Daku, Guyam, and Naked Island boat hopping day',
      'Sugba Lagoon wooden springboard cliff jump',
      'Sunset view from the iconic bent coconut palm tree',
    ],
    mustTryBites: [
      'Acai and mango smoothie bowls at Shaka Cafe',
      'Fresh Yellowfin Tuna Kinilaw with calamansi & coconut milk',
      'Warm traditional Pan de Coco fresh from wood ovens',
    ],
    travelTip: 'Check the tide chart beforehand: Magpupungko rock pools are only accessible and crystal clear during low tide.',
  },
  {
    id: 'panglao_summer',
    name: 'Panglao & Balicasag',
    province: 'Bohol',
    region: 'Visayas',
    tagline: 'Dolphin Pods, Sea Turtles & Pure Sandbars',
    season: 'summer',
    category: 'beach',
    whyNow: 'Glassy March–May waters provide the best conditions for morning dolphin watching and swimming alongside giant sea turtles.',
    whyNowDetails: 'Panglao is a barkada favorite for water adventures. Hop on an outrigger boat at 6:00 AM to see playful wild dolphins, snorkel the deep coral walls of Balicasag, and walk along the pure white Virgin Island sandbar.',
    imageUrl: 'https://images.unsplash.com/photo-1544620347-c4fd4a3d5957?auto=format&fit=crop&w=800&q=80',
    vibeTag: 'Turtles & Sandbars',
    weatherTemp: '26°C – 33°C',
    bestMonths: 'Mar – May',
    budgetLevel: '₱₱',
    highlights: [
      'Balicasag Island sea turtle sanctuary snorkeling',
      'Virgin Island crescent sandbar walk during morning low tide',
      'Chocolate Hills panoramic sunrise viewing',
      'Loboc River cruise lunch with live folk music',
    ],
    mustTryBites: [
      'Bohol Peanut Kisses crunchy cookies',
      'Bohol Bee Farm artisanal honey ice cream in cassava cone',
      'Fresh sweet Carabao mangoes',
    ],
    travelTip: 'Start your island hopping by 6:00 AM sharp to maximize dolphin spotting before boat traffic arrives.',
  },
  {
    id: 'la_union_summer',
    name: 'San Juan, La Union (Elyu)',
    province: 'La Union',
    region: 'Luzon',
    tagline: 'Beachside Cafes, Sunset Sessions & Road Trips',
    season: 'summer',
    category: 'beach',
    whyNow: 'The classic barkada road trip destination! Vibrant beach clubs, chill cafe culture, and stunning fiery orange sunsets over the West Philippine Sea.',
    whyNowDetails: 'Just a 4-hour scenic drive along TPLEX from Manila, Elyu has transformed into the youth capital for beach cafes, food spots, acoustic sessions, and sunset chill. Summer delivers warm water, beach volleyball, and buzzing nightlife.',
    imageUrl: 'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&w=800&q=80',
    vibeTag: 'Elyu Road Trip & Cafes',
    weatherTemp: '27°C – 34°C',
    bestMonths: 'Mar – May',
    budgetLevel: '₱₱',
    highlights: [
      'Urbiztondo sunset chill with live acoustic beats',
      'Cafe hopping along the vibrant Great Northwest strip',
      'Tangadan Falls bamboo raft ride and cold dip',
      'Beach volleyball and night lounges on the sand',
    ],
    mustTryBites: [
      'Halo-halo de Iloko with creamy cheese and pastillas',
      'El Union specialty cold brew & hot skillet s’mores cookie',
      'Flapjack breakfast pancakes and artisan sourdough toast',
    ],
    travelTip: 'Book accommodations in Urbiztondo 2–3 weeks in advance for summer weekends as boutique hostels fill up fast.',
  },
  {
    id: 'gigantes_summer',
    name: 'Islas de Gigantes, Carles',
    province: 'Iloilo',
    region: 'Visayas',
    tagline: '1-Peso Scallops Feast & Hidden Lagoons',
    season: 'summer',
    category: 'beach',
    whyNow: 'Summer is the only time the open Visayan Sea is calm enough for smooth boat rides between Cabugao Gamay and Tangke Saltwater Lagoon.',
    whyNowDetails: 'A true hidden paradise for adventurers! Climb the iconic rock viewpoint of Cabugao Gamay island, swim in the natural saltwater lagoon of Tangke nestled among limestone cliffs, and eat fresh steamed scallops by the bucket.',
    imageUrl: 'https://images.unsplash.com/photo-1518509562904-e7ef99cdcc86?auto=format&fit=crop&w=800&q=80',
    vibeTag: 'Island Hopping & Scallops',
    weatherTemp: '26°C – 32°C',
    bestMonths: 'Mar – May',
    budgetLevel: '₱',
    highlights: [
      'Cabugao Gamay postcard-perfect limestone rock viewpoint',
      'Tangke saltwater lagoon cliff plunge',
      'Bantigue sandbar long beach walk',
      'Unlimited scallops feast right on the boat',
    ],
    mustTryBites: [
      'Unlimited fresh steamed garlic scallops by the pail',
      'Wasay-wasay axe-shaped rock oysters',
      'Native chicken binakol simmered in coconut water',
    ],
    travelTip: 'Take the morning boat from Bancal Port in Carles for the calmest sea crossing.',
  },

  // ==========================================
  // MONSOON SEASON (June – August)
  // ==========================================
  {
    id: 'laguna_monsoon',
    name: 'Pansol & Los Baños',
    province: 'Laguna',
    region: 'Luzon',
    tagline: 'Private Hot Spring Villas & Night Soaks',
    season: 'monsoon',
    category: 'cozy',
    whyNow: 'Nothing beats a soothing 38°C natural geothermal hot spring while rain patters on the roof. Perfect for private barkada villa sleepovers.',
    whyNowDetails: 'While beach trips get rained out, Laguna’s natural hot springs thrive in June through August. Rent a private villa with hot sulfuric pools, karaoke, billiards, and BBQ grills for an unforgettable barkada bonding weekend.',
    imageUrl: 'https://images.unsplash.com/photo-1540555700478-4be289fbecef?auto=format&fit=crop&w=800&q=80',
    vibeTag: 'Hot Springs & Private Villa',
    weatherTemp: '24°C – 29°C',
    bestMonths: 'Jun – Aug',
    budgetLevel: '₱',
    highlights: [
      'All-night private hot spring soaking under the rain',
      'Barkada karaoke marathon with unlimited videoke',
      'Billiards tournament and BBQ pool party',
      'Views of rain mist dancing across Mt. Makiling',
    ],
    mustTryBites: [
      'Piping-hot original Los Baños Buko Pie from The Original',
      'Sweet chewy Espasol rolled in toasted flour',
      'Kesong puti with warm fresh morning pandesal',
    ],
    travelTip: 'Look for private villas with natural running sulfuric hot spring water directly from Mt. Makiling.',
  },
  {
    id: 'tagaytay_monsoon',
    name: 'Tagaytay Misty Ridge',
    province: 'Cavite',
    region: 'Luzon',
    tagline: 'Misty Ridge Overlook & Steaming Bulalo',
    season: 'monsoon',
    category: 'cozy',
    whyNow: 'Foggy afternoons, cool rain mist, and steaming bowls of rich bone marrow bulalo make Tagaytay the coziest rainy weekend getaway.',
    whyNowDetails: 'On a drizzly afternoon, Tagaytay transforms into a cinematic wonderland. Sit in an overlooking glass cafe with warm coffee, split a hot bubbling bowl of bulalo with friends, and enjoy cool breezes without summer traffic.',
    imageUrl: 'https://images.unsplash.com/photo-1506744038136-46273834b3fb?auto=format&fit=crop&w=800&q=80',
    vibeTag: 'Rainy Overlook & Bulalo',
    weatherTemp: '20°C – 25°C',
    bestMonths: 'Jun – Aug',
    budgetLevel: '₱₱',
    highlights: [
      'Mahogany Market hot bulalo lunch with marrow bone soup',
      'Cozy cabin staycation with indoor board games and tea',
      'Cafe hopping along ridge cafes overlooking misty Taal',
      'Spa and relaxation treatments in wellness resorts',
    ],
    mustTryBites: [
      'Steaming bone marrow Bulalo with sweet corn',
      'Crispy fried Tawilis with spicy vinegar',
      'Warm Tsokolate de Batirol with freshly made bibingka',
    ],
    travelTip: 'Bring warm hoodies and an umbrella. The ridge fog rolls in quickly around 3:00 PM.',
  },
  {
    id: 'baler_monsoon',
    name: 'Baler',
    province: 'Aurora',
    region: 'Luzon',
    tagline: 'Southwest Monsoon Swells & Cascading Waterfalls',
    season: 'monsoon',
    category: 'beach',
    whyNow: 'Habagat monsoon winds generate long, rolling surf swells at Sabang Beach, while waterfalls like Ditumabo are at their most majestic.',
    whyNowDetails: 'June to August kicks off the thrilling swell season for surfing in Baler. Beginners and intermediate surfers enjoy consistent rolling waves, Ditumabo Mother Falls is roaring with fresh rainwater, and cozy surf hostels offer great barkada rates.',
    imageUrl: 'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&w=800&q=80',
    vibeTag: 'Monsoon Surfing & Falls',
    weatherTemp: '24°C – 30°C',
    bestMonths: 'Jun – Oct',
    budgetLevel: '₱',
    highlights: [
      'Surfing lessons with licensed local instructors at Sabang Beach',
      'Trekking to roaring Ditumabo Mother Falls for a cold plunge',
      'Climbing inside the massive 600-year-old Balete Millennium Tree',
      'Museo de Baler and Doña Aurora Aragon Quezon ancestral house',
    ],
    mustTryBites: [
      'Pako (wild river fern) salad with salted egg and tomatoes',
      'Nanay Pacing homemade toasted peanut butter',
      'Freshly grilled blue marlin with garlic rice',
    ],
    travelTip: 'Book a certified surf instructor at Sabang Beach—they will coach you on paddling, wave timing, and safety.',
  },
  {
    id: 'tanay_monsoon',
    name: 'Tanay & Antipolo',
    province: 'Rizal',
    region: 'Luzon',
    tagline: 'Mountain Fog, Forest Cafes & City Lights',
    season: 'monsoon',
    category: 'cozy',
    whyNow: 'Just 1 hour from Metro Manila! Cool mountain breezes, scenic winding roads, and forest-tucked coffee shops with panoramic skyline views.',
    whyNowDetails: 'When a quick weekend breather is needed, Tanay and Marilaque highway offer lush greenery, mountain mist, and aesthetic forest cafes where barkadas can sip hot cocoa while watching clouds drift across the Sierra Madre range.',
    imageUrl: 'https://images.unsplash.com/photo-1518709268805-4e9042af9f23?auto=format&fit=crop&w=800&q=80',
    vibeTag: 'Mountain Mist Cafes',
    weatherTemp: '22°C – 28°C',
    bestMonths: 'Jun – Oct',
    budgetLevel: '₱',
    highlights: [
      'Cafe hopping along Marilaque highway overlooking valleys',
      'Watching rain clouds drift across the Sierra Madre range',
      'Daranak Falls natural cold pool swim after light showers',
      'Pinto Art Museum gallery exploration in Antipolo',
    ],
    mustTryBites: [
      'Antipolo cashew nuts & warm toasted suman sa ibos',
      'Native hot chocolate with cinnamon churros',
      'Artisan wood-fired mountain pizza',
    ],
    travelTip: 'Take Marcos Highway early in the morning for fog-shrouded viewpoints with minimal motorcycle traffic.',
  },
  {
    id: 'camiguin_monsoon',
    name: 'Camiguin Island',
    province: 'Northern Mindanao',
    region: 'Mindanao',
    tagline: 'Geothermal Springs, Cascades & Rain Forests',
    season: 'monsoon',
    category: 'cozy',
    whyNow: 'Rainy season feeds the island’s hot geothermal pools (Ardent Hot Spring) and gushing waterfalls into a lush tropical sanctuary.',
    whyNowDetails: 'Born of fire, Camiguin has more volcanoes than towns! The rainy season keeps the island’s hot sulfuric springs bubbling at a soothing 39°C, while majestic Katibawasan Falls plunges 250 feet into a forest pool surrounded by wild orchids.',
    imageUrl: 'https://images.unsplash.com/photo-1540555700478-4be289fbecef?auto=format&fit=crop&w=800&q=80',
    vibeTag: 'Volcanic Springs & Falls',
    weatherTemp: '24°C – 30°C',
    bestMonths: 'Jun – Oct',
    budgetLevel: '₱₱',
    highlights: [
      'Ardent Geothermal Hot Springs night bath under forest canopy',
      'Katibawasan Falls 250-foot roaring mountain cascade',
      'Sunken Cemetery historic cross boat visit and sunset',
      'Sto. Niño natural cold springs swim',
    ],
    mustTryBites: [
      'Pastel de Camiguin (soft sweet buns filled with creamy yema)',
      'Fresh sweet Lanzones harvested from local orchards',
      'Kipping (crispy giant cassava wafers with latik syrup)',
    ],
    travelTip: 'Visit Ardent Hot Spring in the evening between 7:00 PM and 9:00 PM when the night air is cool and relaxing.',
  },
];

/**
 * Smart detection of the current Philippine season based on date.
 * (Default: current date today).
 */
export function getCurrentPhilippineSeason(date: Date = new Date()): SeasonMeta {
  const month = date.getMonth(); // 0 = Jan, 11 = Dec

  // March, April, May (2, 3, 4) -> Summer
  if (month >= 2 && month <= 4) {
    return PHILIPPINE_SEASONS.find((s) => s.key === 'summer')!;
  }
  // June, July, August (5, 6, 7) -> Monsoon
  if (month >= 5 && month <= 7) {
    return PHILIPPINE_SEASONS.find((s) => s.key === 'monsoon')!;
  }
  // September, October, November (8, 9, 10) -> Ber Months
  if (month >= 8 && month <= 10) {
    return PHILIPPINE_SEASONS.find((s) => s.key === 'ber_months')!;
  }
  // December, January, February (11, 0, 1) -> Amihan
  return PHILIPPINE_SEASONS.find((s) => s.key === 'amihan')!;
}

/**
 * Returns metadata for a specific season key.
 */
export function getSeasonMeta(key: PhilippineSeasonKey): SeasonMeta {
  return PHILIPPINE_SEASONS.find((s) => s.key === key) || PHILIPPINE_SEASONS[0];
}

/**
 * Returns curated spots matching the selected season and optional category filter.
 */
export function getSpotsBySeason(
  seasonKey: PhilippineSeasonKey,
  category: SpotCategory = 'all'
): PhilippineSpot[] {
  return PHILIPPINE_SPOTS.filter((spot) => {
    const matchesSeason = spot.season === seasonKey || spot.secondarySeason === seasonKey;
    if (!matchesSeason) return false;
    if (category === 'all') return true;
    return spot.category === category;
  });
}
