export type FormatId = "square" | "portrait" | "story" | "landscape";
export type TemplateId = "headline" | "quote" | "event" | "photo" | "stat" | "type";
export type PaletteId = "navy" | "cream" | "olive";
export type PosterValues = Record<string, string>;

export interface FormatDefinition {
  id: FormatId;
  label: string;
  width: number;
  height: number;
  ratio: string;
  description: string;
}

export interface TemplateField {
  key: string;
  label: string;
  type: "text" | "textarea" | "date" | "time";
  maxLength: number;
  placeholder: string;
  required: boolean;
}

export interface TemplateDefinition {
  id: TemplateId;
  name: string;
  category: string;
  description: string;
  tag: string;
  defaultValues: PosterValues;
  fields: TemplateField[];
  photo: boolean;
}

export interface PaletteDefinition {
  id: PaletteId;
  label: string;
  background: string;
  foreground: string;
  accent: string;
}

export interface PosterImage {
  name: string;
  src: string;
  width: number;
  height: number;
}

export interface PosterConfig {
  templateId: TemplateId;
  formatId: FormatId;
  paletteId: PaletteId;
  // Overrides the palette accent (date panel, source panel, rules); unset = palette default.
  accentId?: PaletteId;
  variant: "classic" | "bold";
  values: PosterValues;
  image?: PosterImage;
  // Replaces the Nouvelle Énergie logo on the poster when set.
  logo?: PosterImage;
  // Footer line; undefined = site URL, empty string = no footer.
  footerText?: string;
}

export interface RenderResult {
  fits: boolean;
  error?: string;
  altText: string;
}
