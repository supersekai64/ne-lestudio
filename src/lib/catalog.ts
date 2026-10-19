import type {
  FormatDefinition,
  PaletteDefinition,
  PosterConfig,
  TemplateDefinition,
  TemplateId,
} from "./studio-types";

export const POSTER_WEBSITE_URL = "https://www.unenouvelleenergie.fr/";

export const FORMATS: FormatDefinition[] = [
  { id: "square", label: "Carré", width: 1080, height: 1080, ratio: "1 / 1", description: "Publication · 1080 × 1080" },
  { id: "portrait", label: "Portrait", width: 1080, height: 1350, ratio: "4 / 5", description: "Fil d’actualité · 1080 × 1350" },
  { id: "story", label: "Story", width: 1080, height: 1920, ratio: "9 / 16", description: "Format vertical · 1080 × 1920" },
  { id: "landscape", label: "Paysage", width: 1200, height: 675, ratio: "16 / 9", description: "Publication · 1200 × 675" },
];

export const PALETTES: PaletteDefinition[] = [
  { id: "navy", label: "Bleu", background: "#032F67", foreground: "#FFFFFF", accent: "#A0A37E" },
  { id: "cream", label: "Blanc", background: "#FFFFFF", foreground: "#032F67", accent: "#A0A37E" },
  { id: "olive", label: "Kaki", background: "#A0A37E", foreground: "#032F67", accent: "#FFFFFF" },
];

export const ACCENT_COLORS = PALETTES.map((palette) => ({ id: palette.id, label: palette.label, color: palette.background }));

export function resolveAccent(config: Pick<PosterConfig, "paletteId" | "accentId">): string {
  const palette = PALETTES.find((entry) => entry.id === config.paletteId) ?? PALETTES[0];
  const chosen = ACCENT_COLORS.find((entry) => entry.id === config.accentId && entry.color !== palette.background);
  return chosen?.color ?? palette.accent;
}

export const TEMPLATES: TemplateDefinition[] = [
  {
    id: "headline", name: "Une idée forte", category: "Message", tag: "L’essentiel",
    description: "Une accroche, quelques mots. Votre message prend toute sa place.", photo: false,
    defaultValues: { title: "Un nouvel élan pour nos territoires", subtitle: "Votre message, simplement." },
    fields: [
      { key: "title", label: "Votre message", type: "textarea", maxLength: 110, placeholder: "L’idée que vous souhaitez partager", required: true },
      { key: "subtitle", label: "Une précision", type: "text", maxLength: 100, placeholder: "Quelques mots en complément (facultatif)", required: false },
    ],
  },
  {
    id: "quote", name: "Les mots justes", category: "Citation", tag: "Citation libre",
    description: "Saisissez votre citation et, si vous le souhaitez, son auteur.", photo: false,
    defaultValues: { title: "Des idées à partager, des mots pour les faire vivre.", subtitle: "Nom de l’auteur" },
    fields: [
      { key: "title", label: "Votre citation", type: "textarea", maxLength: 300, placeholder: "Le texte de la citation que vous souhaitez partager", required: true },
      { key: "subtitle", label: "Auteur", type: "text", maxLength: 80, placeholder: "Le nom de l’auteur (facultatif)", required: false },
    ],
  },
  {
    id: "event", name: "On se retrouve", category: "Événement", tag: "Rendez-vous",
    description: "Un titre, une date, un lieu. Tout pour présenter votre rendez-vous.", photo: false,
    defaultValues: { title: "Rencontrons-nous", subtitle: "Échangeons nos idées", date: "2026-11-05", time: "18:30", location: "Maison des associations · Votre ville" },
    fields: [
      { key: "title", label: "Nom de l’événement", type: "textarea", maxLength: 85, placeholder: "Le titre de votre rendez-vous", required: true },
      { key: "subtitle", label: "Une précision", type: "text", maxLength: 85, placeholder: "Le thème ou le programme (facultatif)", required: false },
      { key: "date", label: "Date", type: "date", maxLength: 10, placeholder: "", required: true },
      { key: "time", label: "Heure", type: "time", maxLength: 5, placeholder: "", required: true },
      { key: "location", label: "Lieu", type: "textarea", maxLength: 100, placeholder: "Lieu et ville", required: true },
    ],
  },
  {
    id: "photo", name: "En images", category: "Image", tag: "Votre image",
    description: "Ajoutez votre photo et personnalisez votre message.", photo: true,
    defaultValues: { title: "Les idées prennent vie", subtitle: "Un message, une image, une nouvelle perspective." },
    fields: [
      { key: "title", label: "Votre message", type: "textarea", maxLength: 85, placeholder: "L’accroche de votre visuel", required: true },
      { key: "subtitle", label: "Une précision", type: "text", maxLength: 100, placeholder: "Quelques mots en complément (facultatif)", required: false },
    ],
  },
  {
    id: "stat", name: "Un chiffre qui parle", category: "Chiffre", tag: "Avec sa source",
    description: "Mettez une donnée en perspective et indiquez toujours sa source.", photo: false,
    defaultValues: { number: "Votre chiffre", title: "Donnez du sens à vos données", subtitle: "Précisez le contexte en quelques mots.", source: "Indiquez l’organisme, l’étude ou le lien." },
    fields: [
      { key: "number", label: "Votre chiffre", type: "text", maxLength: 18, placeholder: "Ex. : 42 %", required: true },
      { key: "title", label: "Ce qu’il représente", type: "textarea", maxLength: 85, placeholder: "Expliquez le chiffre en quelques mots", required: true },
      { key: "subtitle", label: "Le contexte", type: "text", maxLength: 100, placeholder: "Une précision utile (facultatif)", required: false },
      { key: "source", label: "La source", type: "textarea", maxLength: 120, placeholder: "Organisme, étude, date ou lien", required: true },
    ],
  },
  {
    id: "type", name: "À voix haute", category: "Typographie", tag: "Grand texte",
    description: "Des mots en grand, une composition simple et assumée.", photo: false,
    defaultValues: { title: "Faire entendre\nvotre voix.", subtitle: "Une idée mérite d’être partagée." },
    fields: [
      { key: "title", label: "Votre message", type: "textarea", maxLength: 100, placeholder: "Quelques mots qui vous ressemblent", required: true },
      { key: "subtitle", label: "Une précision", type: "text", maxLength: 85, placeholder: "Quelques mots en complément (facultatif)", required: false },
    ],
  },
];

export function createDefaultConfig(templateId: TemplateId): PosterConfig {
  const template = TEMPLATES.find((entry) => entry.id === templateId) ?? TEMPLATES[0];
  return {
    templateId: template.id, formatId: "square", paletteId: "navy", variant: "classic",
    values: { ...template.defaultValues },
  };
}

export function formatEventDate(value: string): string {
  const parts = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!parts) return "Date à préciser";
  const year = Number(parts[1]);
  const month = Number(parts[2]);
  const day = Number(parts[3]);
  const date = new Date(year, month - 1, day, 12);
  if (date.getFullYear() !== year || date.getMonth() !== month - 1 || date.getDate() !== day) return "Date à préciser";
  return new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "long", year: "numeric" }).format(date);
}

export function describePoster(config: PosterConfig): string {
  const template = TEMPLATES.find((entry) => entry.id === config.templateId) ?? TEMPLATES[0];
  const format = FORMATS.find((entry) => entry.id === config.formatId) ?? FORMATS[0];
  const value = (key: string) => (config.values[key] ?? "").trim();
  const pieces = [`Visuel ${format.label.toLowerCase()}, modèle « ${template.name} ».`];
  if (config.templateId === "quote") {
    if (value("title")) pieces.push(`Citation : ${value("title")}`);
    if (value("subtitle")) pieces.push(`Auteur : ${value("subtitle")}.`);
  } else {
    if (value("number")) pieces.push(value("number"));
    if (value("title")) pieces.push(value("title").replace(/\s+/g, " "));
    if (value("subtitle")) pieces.push(value("subtitle"));
    if (config.templateId === "event") pieces.push(`${formatEventDate(value("date"))}${value("time") ? ` à ${value("time")}` : ""}. ${value("location")}`);
    if (config.templateId === "stat" && value("source")) pieces.push(`Source : ${value("source")}.`);
    if (config.templateId === "photo" && config.image) pieces.push("Image personnelle importée.");
  }
  pieces.push(`Site : ${POSTER_WEBSITE_URL}`);
  return pieces.join(" ");
}
