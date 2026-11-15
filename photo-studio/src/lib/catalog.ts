import type { AngleKey, AspectRatio, Collection, Energy, Industry, IntentKey } from "./types";

export const ANGLES: { key: AngleKey; label: string; hint: string; required: boolean }[] = [
  { key: "front", label: "Face", hint: "Buste, regard caméra", required: true },
  { key: "right45", label: "45° droite", hint: "Tournez-vous de 45° vers la droite", required: false },
  { key: "profile", label: "Profil droit", hint: "Profil complet, demandez à un proche", required: false },
  { key: "fullbody", label: "En pied", hint: "De la tête aux genoux, de face", required: false },
];

export const ASPECT_RATIOS: { key: AspectRatio; label: string; usage: string; promptHint: string }[] = [
  { key: "4:5", label: "4:5", usage: "Feed Instagram / LinkedIn", promptHint: "4:5 vertical portrait, taller than wide" },
  { key: "9:16", label: "9:16", usage: "Story / Reel / TikTok", promptHint: "9:16 vertical full-length story format" },
  { key: "1:1", label: "1:1", usage: "Photo de profil", promptHint: "1:1 square format" },
  { key: "16:9", label: "16:9", usage: "Bannière site / YouTube", promptHint: "16:9 wide horizontal format with negative space" },
];

export const INTENTS: { key: IntentKey; label: string; shortLabel: string; description: string }[] = [
  {
    key: "website_profile",
    label: "Site & profil",
    shortLabel: "Site",
    description: "Des photos intemporelles pour votre page d'accueil, votre page « À propos », votre dossier de presse ou LinkedIn. Vous les garderez des années.",
  },
  {
    key: "campaign",
    label: "Campagne",
    shortLabel: "Campagne",
    description: "Liées à un lancement, une offre ou une annonce. De l'énergie et de l'urgence. Retirées après la campagne.",
  },
  {
    key: "social_content",
    label: "Contenu social",
    shortLabel: "Social",
    description: "Pour être présente chaque semaine. Vrai, chaleureux, proche. Votre photographe IA, un mardi ordinaire.",
  },
  {
    key: "industry",
    label: "Mon métier",
    shortLabel: "Métier",
    description: "Des scènes de vie authentiques propres à votre secteur : vrais gestes, vrais lieux, pour montrer l'experte que vous êtes déjà.",
  },
];

export const LOADING_MESSAGES = [
  "Installation des lumières…",
  "Recherche du meilleur angle…",
  "Mesure de la lumière…",
  "Ajustement du cadrage…",
  "Presque prêt…",
];

type CollectionSeed = Omit<Collection, "intent">;

const WEBSITE: CollectionSeed[] = [
  {
    key: "editorial_studio",
    name: "Portrait éditorial",
    tagline: "Fond uni, lumière sculptée, assurance tranquille",
    energy: "polished",
    scene: "minimal photo studio with a seamless warm-grey paper backdrop",
    wardrobe: "tailored blazer over a simple top, refined jewelry",
    lighting: "large softbox key light at 45 degrees with gentle fill and a subtle rim light",
    camera: "85mm lens, f/2.8, chest-up framing, eye level",
    mood: "confident, calm authority",
  },
  {
    key: "bright_office",
    name: "Bureau lumineux",
    tagline: "L'experte dans son espace de travail",
    energy: "polished",
    scene: "bright modern office with large windows, plants and light oak furniture, softly blurred background",
    wardrobe: "smart business casual outfit",
    lighting: "soft natural window light from the side, clean highlights",
    camera: "50mm lens, f/2.0, waist-up, slight three-quarter angle",
    mood: "competent, approachable professional",
  },
  {
    key: "neighbourhood_cafe",
    name: "Café de quartier",
    tagline: "Chaleureuse, accessible, prête à échanger",
    energy: "warm",
    scene: "cozy independent coffee shop with wooden tables and warm ambient bokeh",
    wardrobe: "soft knit sweater or relaxed shirt",
    lighting: "warm window light mixed with practical tungsten lamps",
    camera: "50mm lens, f/1.8, seated at a table, waist-up",
    mood: "friendly, genuine, inviting",
  },
  {
    key: "mineral_wall",
    name: "Mur minéral",
    tagline: "Texture naturelle, élégance sobre",
    energy: "polished",
    scene: "outdoor textured limestone wall in soft shade",
    wardrobe: "monochrome elegant outfit",
    lighting: "open shade, even diffused daylight, soft shadows",
    camera: "70mm lens, f/2.8, three-quarter body framing",
    mood: "elegant, grounded, timeless",
  },
  {
    key: "window_light",
    name: "Lumière de fenêtre",
    tagline: "Douceur naturelle pour votre page « À propos »",
    energy: "warm",
    scene: "airy living space with sheer curtains, minimal decor",
    wardrobe: "light-colored comfortable yet polished outfit",
    lighting: "soft diffused window light, gentle falloff into shadow",
    camera: "85mm lens, f/2.0, head and shoulders, slight head tilt",
    mood: "warm, sincere, open",
  },
  {
    key: "speaker",
    name: "Conférencière",
    tagline: "Pour votre dossier de presse et vos événements",
    energy: "polished",
    scene: "conference stage with a softly lit audience out of focus in the background",
    wardrobe: "statement blazer, lapel microphone",
    lighting: "stage spotlight key with warm ambient spill",
    camera: "135mm lens, f/2.8, waist-up, slightly low angle",
    mood: "inspiring, commanding, expressive",
  },
];

const CAMPAIGN: CollectionSeed[] = [
  {
    key: "brand_color_studio",
    name: "Studio aux couleurs",
    tagline: "Fond aux couleurs de votre marque, impact immédiat",
    energy: "polished",
    scene: "studio with a seamless backdrop in the brand primary color",
    wardrobe: "outfit in the brand secondary color, bold silhouette",
    lighting: "crisp beauty-dish key light, high contrast but flattering",
    camera: "70mm lens, f/4, three-quarter body, dynamic pose",
    mood: "bold, energetic, launch-day excitement",
  },
  {
    key: "urban_announcement",
    name: "Annonce urbaine",
    tagline: "En mouvement dans la ville, l'élan d'un lancement",
    energy: "polished",
    scene: "modern city street with architectural lines and soft background motion",
    wardrobe: "sharp coat or structured jacket",
    lighting: "golden-hour side light with long soft shadows",
    camera: "35mm lens, f/2.8, full body walking toward camera",
    mood: "determined, ambitious, momentum",
  },
  {
    key: "launch_celebration",
    name: "Célébration",
    tagline: "Le jour J, la joie sincère du lancement",
    energy: "warm",
    scene: "intimate celebration with soft confetti in the air and warm string lights",
    wardrobe: "festive yet elegant outfit",
    lighting: "warm practical lights with soft flash fill",
    camera: "35mm lens, f/2.0, waist-up, candid laughter",
    mood: "joyful, celebratory, authentic",
  },
  {
    key: "behind_the_scenes",
    name: "Coulisses",
    tagline: "Les préparatifs avant le grand jour",
    energy: "warm",
    scene: "creative workspace with laptop, notes and mood board, slightly busy but tidy",
    wardrobe: "casual chic outfit, sleeves rolled",
    lighting: "natural daylight with a warm desk lamp",
    camera: "28mm lens, f/2.8, documentary-style candid framing",
    mood: "focused, real, anticipation",
  },
  {
    key: "rooftop_sunset",
    name: "Rooftop au coucher",
    tagline: "Horizon ouvert pour une nouvelle étape",
    energy: "warm",
    scene: "city rooftop terrace at sunset with skyline softly blurred",
    wardrobe: "flowing elegant outfit",
    lighting: "warm backlight from the setting sun with soft reflector fill",
    camera: "85mm lens, f/2.0, three-quarter body",
    mood: "optimistic, free, aspirational",
  },
  {
    key: "keynote",
    name: "Keynote",
    tagline: "Annonce sur scène, posture de leader",
    energy: "polished",
    scene: "large keynote stage with a blank screen behind, audience silhouettes",
    wardrobe: "power suit or elegant dress",
    lighting: "dramatic stage lighting with clean key and colored ambient",
    camera: "200mm lens, f/2.8, waist-up, mid-gesture",
    mood: "visionary, authoritative",
  },
];

const SOCIAL: CollectionSeed[] = [
  {
    key: "morning_coffee",
    name: "Café & carnet",
    tagline: "Rituel du matin, planification de la semaine",
    energy: "warm",
    scene: "kitchen table in the morning with coffee cup, notebook and pen",
    wardrobe: "cozy knit, natural look",
    lighting: "soft morning window light, warm tones",
    camera: "35mm lens, f/2.0, slightly high angle, candid",
    mood: "calm, relatable, everyday",
  },
  {
    key: "video_call",
    name: "Visio depuis le salon",
    tagline: "En pleine séance avec une cliente",
    energy: "warm",
    scene: "home office corner with laptop, bookshelf and plant",
    wardrobe: "smart casual top",
    lighting: "soft daylight with a warm practical lamp",
    camera: "35mm lens, f/2.8, over-the-laptop perspective, mid-conversation",
    mood: "engaged, helpful, authentic",
  },
  {
    key: "city_walk",
    name: "Balade en ville",
    tagline: "Entre deux rendez-vous, naturelle",
    energy: "warm",
    scene: "charming city sidewalk with cafés and trees",
    wardrobe: "trench coat or denim jacket, tote bag",
    lighting: "bright overcast daylight, even and flattering",
    camera: "50mm lens, f/2.0, full body mid-stride, candid",
    mood: "free, spontaneous, real",
  },
  {
    key: "creative_desk",
    name: "Bureau créatif",
    tagline: "Les mains dans le projet",
    energy: "warm",
    scene: "creative desk with samples, sketches and a laptop",
    wardrobe: "relaxed shirt",
    lighting: "natural side light, soft shadows",
    camera: "35mm lens, f/2.8, waist-up, looking at work then at camera",
    mood: "passionate, hands-on",
  },
  {
    key: "terrace_lunch",
    name: "Déjeuner en terrasse",
    tagline: "Un moment de pause partagé",
    energy: "warm",
    scene: "sunny restaurant terrace with a simple lunch table",
    wardrobe: "light summer outfit, sunglasses on head",
    lighting: "dappled sunlight under an umbrella",
    camera: "50mm lens, f/1.8, seated, genuine smile",
    mood: "relaxed, social, joyful",
  },
  {
    key: "quote_card",
    name: "Portrait pensif",
    tagline: "Idéal pour accompagner une citation",
    energy: "polished",
    scene: "minimal interior with a plain wall leaving negative space on one side",
    wardrobe: "simple solid-colored top",
    lighting: "soft directional light, gentle contrast",
    camera: "85mm lens, f/2.0, subject off-center, looking away thoughtfully",
    mood: "reflective, inspiring",
  },
];

export const INDUSTRIES: Industry[] = [
  { key: "coach", name: "Coach & consultante", settings: ["bright coaching room with two armchairs", "workshop room with flip chart"], props: "notebook, flip chart, coffee cups" },
  { key: "hr_payroll", name: "RH & paie", settings: ["modern HR office with dual monitors showing spreadsheets", "meeting room for an interview"], props: "laptop with payroll dashboard, documents, calculator" },
  { key: "lawyer", name: "Avocate & juriste", settings: ["law office with bookshelves of legal volumes", "elegant meeting room"], props: "files, fountain pen, legal books" },
  { key: "real_estate", name: "Immobilier", settings: ["bright staged apartment living room", "front of a beautiful house"], props: "keys, tablet with floor plan" },
  { key: "beauty", name: "Esthétique & bien-être", settings: ["serene beauty salon treatment room", "spa reception with plants"], props: "skincare products, towels, candles" },
  { key: "trainer", name: "Formatrice", settings: ["training room with participants out of focus", "co-working space"], props: "presentation screen, marker, laptop" },
  { key: "food", name: "Pâtisserie & restauration", settings: ["artisan bakery kitchen", "small restaurant counter"], props: "flour, pastries, apron, wooden boards" },
  { key: "fitness", name: "Sport & fitness", settings: ["bright boutique fitness studio", "outdoor park at morning"], props: "yoga mat, dumbbells, water bottle" },
  { key: "creative", name: "Créative & designer", settings: ["design studio with mood boards", "photo studio with lights"], props: "color swatches, tablet and stylus, camera" },
  { key: "health", name: "Santé & thérapie", settings: ["calm therapy office with soft furniture", "clinic consultation room"], props: "notepad, plants, soft textiles" },
];

function industryCollections(ind: Industry): Collection[] {
  return [
    {
      key: `${ind.key}_action`,
      intent: "industry",
      industry: ind.key,
      name: "En action",
      tagline: "Au cœur de votre métier, geste juste",
      energy: "warm",
      scene: `${ind.settings[0]}, ${ind.props} naturally present`,
      wardrobe: "professional outfit suited to the trade",
      lighting: "natural daylight, documentary feel",
      camera: "35mm lens, f/2.8, candid action shot, waist-up",
      mood: "skilled, absorbed, credible",
    },
    {
      key: `${ind.key}_client`,
      intent: "industry",
      industry: ind.key,
      name: "Avec une cliente",
      tagline: "La relation de confiance en image",
      energy: "warm",
      scene: `${ind.settings[1] ?? ind.settings[0]}, with a client seen from behind or out of focus (never facing camera)`,
      wardrobe: "professional, welcoming outfit",
      lighting: "soft diffused interior light",
      camera: "50mm lens, f/2.0, over-the-shoulder composition, subject in focus",
      mood: "attentive, warm, trustworthy",
    },
    {
      key: `${ind.key}_portrait`,
      intent: "industry",
      industry: ind.key,
      name: "Portrait métier",
      tagline: "L'experte reconnue de son secteur",
      energy: "polished",
      scene: `${ind.settings[0]}, softly blurred background`,
      wardrobe: "polished professional outfit",
      lighting: "soft key light with subtle rim, clean background separation",
      camera: "85mm lens, f/2.2, chest-up, direct eye contact",
      mood: "confident, expert, approachable",
    },
  ];
}

export const COLLECTIONS: Collection[] = [
  ...WEBSITE.map((c) => ({ ...c, intent: "website_profile" as const })),
  ...CAMPAIGN.map((c) => ({ ...c, intent: "campaign" as const })),
  ...SOCIAL.map((c) => ({ ...c, intent: "social_content" as const })),
  ...INDUSTRIES.flatMap(industryCollections),
];

export function findCollection(key: string): Collection | undefined {
  return COLLECTIONS.find((c) => c.key === key);
}

export function collectionsFor(intent: IntentKey, industry?: string | null): Collection[] {
  return COLLECTIONS.filter((c) => c.intent === intent && (intent !== "industry" || c.industry === industry));
}

export function twinForEnergy(energy: Energy): "smiling" | "neutral" {
  return energy === "warm" ? "smiling" : "neutral";
}

export const MAX_PHOTOS_PER_JOB = 4;
export const MAX_PENDING_JOBS = 3;
export const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;
export const ACCEPTED_MIME = ["image/jpeg", "image/png", "image/webp"] as const;
