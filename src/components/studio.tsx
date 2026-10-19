"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type RefObject } from "react";
import { ArrowLeft, ArrowRight, Check, CheckCircle2, CircleAlert, CircleHelp, Download, ImageIcon, Info, LayoutTemplate, LoaderCircle, LockKeyhole, RectangleHorizontal, RectangleVertical, Share2, ShieldCheck, SlidersHorizontal, Smartphone, Square, Trash2, PenLine, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { SelectionCheck } from "@/components/ui/selection-check";
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PosterPreview, type PreviewStatus } from "@/components/poster-preview";
import { ACCENT_COLORS, POSTER_WEBSITE_URL, createDefaultConfig, resolveAccent, describePoster, FORMATS, PALETTES, TEMPLATES } from "@/lib/catalog";
import { IMAGE_ACCEPT, IMAGE_IMPORT_HELP, importPosterImage } from "@/lib/import-image";
import { renderPoster } from "@/lib/render-poster";
import type { FormatId, PosterConfig, TemplateField, TemplateId } from "@/lib/studio-types";

const CATEGORIES = ["Tous les modèles", "Message", "Citation", "Événement", "Image", "Chiffre", "Typographie"];
const GALLERY_CONFIGS = Object.fromEntries(TEMPLATES.map((template, index) => [template.id, {
  ...createDefaultConfig(template.id), paletteId: index === 1 || index === 4 ? "cream" : index === 2 ? "olive" : "navy",
  variant: template.id === "type" ? "bold" : "classic",
}])) as Record<TemplateId, PosterConfig>;
const FORMAT_ICONS = { square: Square, portrait: RectangleVertical, story: Smartphone, landscape: RectangleHorizontal };
const MAX_EXPORT_BYTES = 15 * 1024 * 1024;

function useInertWhenHidden(ref: RefObject<HTMLElement | null>) {
  useEffect(() => {
    const element = ref.current;
    if (!element) return;
    const originalInert = element.inert;
    // Radix hides the page behind its portals. Also remove those controls from
    // keyboard navigation while they are hidden from assistive technology.
    const synchronize = () => { element.inert = originalInert || element.getAttribute("aria-hidden") === "true"; };
    const observer = new MutationObserver(synchronize);
    observer.observe(element, { attributes: true, attributeFilter: ["aria-hidden"] });
    synchronize();
    return () => { observer.disconnect(); element.inert = originalInert; };
  }, [ref]);
}

function HelpDialog() {
  return <Dialog>
    <DialogTrigger asChild><Button variant="ghost" className="header-help" aria-label="Comment ça marche ?"><CircleHelp className="size-4" aria-hidden="true" /><span className="help-label">Comment ça marche ?</span></Button></DialogTrigger>
    <DialogContent><DialogHeader><DialogTitle>Un visuel en trois étapes</DialogTitle><DialogDescription>Vous choisissez le contenu. Le modèle s’occupe de la mise en page.</DialogDescription></DialogHeader>
      <div className="help-steps">
        {[{ title: "Choisissez votre modèle", text: "Message, citation, événement, image ou chiffre : partez d’une composition déjà prête." }, { title: "Ajoutez vos mots", text: "Modifiez les champs proposés, choisissez une couleur et un format. L’aperçu suit vos modifications." }, { title: "Téléchargez votre visuel", text: "Récupérez votre image en PNG ou JPEG pour la publier sur vos réseaux sociaux." }].map((item, index) => <div className="help-step" key={item.title}><span className="step-number">0{index + 1}</span><div><h3>{item.title}</h3><p>{item.text}</p></div></div>)}
      </div>
      <p className="rounded-lg bg-muted p-3 text-sm leading-relaxed text-muted-foreground">Vos textes et vos images restent sur votre appareil pendant la création.</p>
    </DialogContent>
  </Dialog>;
}

function LegalExternalLink({ href, children }: { href: string; children: React.ReactNode }) {
  return <a href={href} target="_blank" rel="noopener noreferrer" className="font-medium text-foreground underline underline-offset-4">{children}<span className="sr-only"> (nouvel onglet)</span></a>;
}

function PrivacyInformation() {
  return <>
    <p>Ce site n’utilise aucun cookie, aucun traceur publicitaire et aucun outil de mesure d’audience. Il fonctionne sans compte utilisateur.</p>
    <p>Les textes saisis, les images importées et les visuels générés sont traités dans la mémoire de votre navigateur. Ils ne sont pas transmis à l’éditeur ou à l’hébergeur, ni enregistrés automatiquement. Les fichiers que vous téléchargez restent sur votre appareil.</p>
    <p>La consultation du site transmet des données techniques à l’hébergeur, notamment l’adresse IP, des informations sur le navigateur et les requêtes. Vercel peut les traiter pour fournir et sécuriser le service, y compris hors de l’Union européenne. Sa <LegalExternalLink href="https://vercel.com/legal/privacy-notice">politique de confidentialité</LegalExternalLink> précise les bases juridiques, les destinataires et les garanties de transfert applicables à ses traitements.</p>
    <p>Vercel indique conserver ces données pendant la durée nécessaire à ses finalités et à ses obligations légales et contractuelles. Les textes et images utilisés dans le générateur ne sont pas inclus dans ces données de connexion.</p>
    <p>Pour toute demande concernant vos données ou l’exercice de vos droits d’accès, de rectification, d’effacement, de limitation ou d’opposition, lorsqu’ils sont applicables, contactez l’éditeur : <span className="font-medium text-foreground">[A VENIR]</span>. Vous pouvez également adresser une réclamation à la <LegalExternalLink href="https://www.cnil.fr/">CNIL</LegalExternalLink>.</p>
    <p>Les sites externes accessibles par les liens du Studio appliquent leurs propres règles de confidentialité.</p>
  </>;
}

function LegalDialog({ kind }: { kind: "rules" | "privacy" }) {
  const rules = kind === "rules";
  return <Dialog>
    <DialogTrigger asChild><button className="footer-link">{rules ? "Règles d’utilisation" : "Confidentialité"}</button></DialogTrigger>
    <DialogContent><DialogHeader><DialogTitle>{rules ? "Un cadre commun pour vos créations" : "Vos textes restent sur votre appareil"}</DialogTitle><DialogDescription>{rules ? "Quelques repères pour créer et partager vos visuels." : "Comment le Studio utilise vos données."}</DialogDescription></DialogHeader>
      <div className="legal-copy">{rules ? <>
        <p>Les modèles intègrent l’identité graphique de Nouvelle Énergie. Personnalisez les champs proposés et vérifiez votre contenu avant de le publier.</p>
        <p>Reprenez fidèlement les propos cités, attribuez-les à leur auteur et indiquez une source vérifiable pour les données chiffrées.</p>
        <p>Utilisez uniquement des contenus dont vous détenez les droits, et respectez les personnes. Choisissez le format adapté au réseau sur lequel vous souhaitez partager votre création.</p>
      </> : <PrivacyInformation />}</div>
    </DialogContent>
  </Dialog>;
}

function LegalNoticeDialog() {
  const titleRef = useRef<HTMLHeadingElement>(null);
  return <Dialog>
    <DialogTrigger asChild><button className="footer-link">Mentions légales</button></DialogTrigger>
    <DialogContent className="sm:max-w-2xl [scrollbar-gutter:stable_both-edges]" onOpenAutoFocus={(event) => { event.preventDefault(); titleRef.current?.focus({ preventScroll: true }); }}>
      <DialogHeader>
        <DialogTitle ref={titleRef} tabIndex={-1} className="outline-none">Mentions légales</DialogTitle>
        <DialogDescription>Informations sur l’initiative, son éditeur et l’utilisation du site.</DialogDescription>
      </DialogHeader>
      <div className="legal-copy space-y-6">
        <section aria-labelledby="legal-initiative-title" className="rounded-lg border border-border bg-muted p-4">
          <h3 id="legal-initiative-title" className="text-lg font-normal leading-normal">Une initiative personnelle</h3>
          <p>Le Studio est une initiative personnelle de Paul CORNILLAD. À ce jour, ce projet n’est pas soutenu par le parti Nouvelle Énergie et ne constitue pas un service officiel du parti.</p>
          <p>L’utilisation de l’identité graphique de Nouvelle Énergie et la présence d’un lien vers son site ne valent pas approbation de cette initiative.</p>
        </section>
        <section aria-labelledby="legal-publisher-title">
          <h3 id="legal-publisher-title" className="text-lg font-normal leading-normal">Éditeur et directeur de publication</h3>
          <p>Paul CORNILLAD, agissant à titre personnel et non professionnel, est l’éditeur et le directeur de publication du site Le Studio.</p>
          <p>Contact : <span className="font-medium text-foreground">[A VENIR]</span>.</p>
          <p>Conception et développement : <LegalExternalLink href="https://www.linkedin.com/in/paul-cornillad/">Paul CORNILLAD sur LinkedIn</LegalExternalLink>.</p>
        </section>
        <section aria-labelledby="legal-host-title">
          <h3 id="legal-host-title" className="text-lg font-normal leading-normal">Hébergement</h3>
          <address className="mt-3 not-italic text-muted-foreground">Vercel Inc.<br />440 N Barranca Avenue #4133<br />Covina, CA 91723, États-Unis</address>
          <p>Téléphone publié par Vercel pour son contact juridique DMCA : <a href="tel:+15592887060" className="text-foreground underline underline-offset-4">+1 559 288 7060</a>.</p>
          <p>Site : <LegalExternalLink href="https://vercel.com/">vercel.com</LegalExternalLink>. <LegalExternalLink href="https://vercel.com/legal/dmca-policy">Coordonnées publiées par Vercel</LegalExternalLink>.</p>
        </section>
        <section aria-labelledby="legal-rights-title">
          <h3 id="legal-rights-title" className="text-lg font-normal leading-normal">Propriété intellectuelle et créations</h3>
          <p>Les noms, marques, logos, polices et autres ressources graphiques restent soumis aux droits de leurs titulaires respectifs. La mise à disposition du générateur ne transfère pas ces droits.</p>
          <p>Vous devez disposer des droits nécessaires sur les images et textes que vous utilisez. Vérifiez le contenu, les sources et les attributions de votre visuel avant toute diffusion. Les créations réalisées avec le Studio ne sont pas des communications officielles de Nouvelle Énergie.</p>
        </section>
        <section aria-labelledby="legal-privacy-title">
          <h3 id="legal-privacy-title" className="text-lg font-normal leading-normal">Données personnelles et cookies</h3>
          <PrivacyInformation />
        </section>
        <p>Dernière mise à jour : <time dateTime="2026-10-13">13 octobre 2026</time>.</p>
      </div>
      <DialogClose asChild><Button variant="outline">Fermer les mentions légales</Button></DialogClose>
    </DialogContent>
  </Dialog>;
}

export function Studio() {
  const [selectedId, setSelectedId] = useState<TemplateId | null>(null);
  const selectedRef = useRef<TemplateId | null>(null);
  // Set by the editor: returns false when the user refuses to drop unsaved changes.
  const leaveGuard = useRef<(() => boolean) | null>(null);
  const [category, setCategory] = useState(CATEGORIES[0]);
  const mainRef = useRef<HTMLElement>(null);
  const shellRef = useRef<HTMLDivElement>(null);
  const skipRef = useRef<HTMLAnchorElement>(null);
  useInertWhenHidden(shellRef);
  useInertWhenHidden(skipRef);
  const visibleTemplates = TEMPLATES.filter((template) => category === CATEGORIES[0] || template.category === category);

  useEffect(() => {
    const wanted = selectedId ? `${TEMPLATES.find((template) => template.id === selectedId)!.name} — Le Studio` : "Le Studio — Projet Lisnard";
    const apply = () => { if (document.title !== wanted) document.title = wanted; };
    apply();
    // Next.js re-commits the metadata <title> after hydration on deep links: reapply ours.
    const observer = new MutationObserver(apply);
    observer.observe(document.head, { childList: true, subtree: true, characterData: true });
    return () => observer.disconnect();
  }, [selectedId]);

  const show = useCallback((id: TemplateId | null) => {
    selectedRef.current = id;
    setSelectedId(id);
    window.scrollTo({ top: 0, behavior: "instant" });
    requestAnimationFrame(() => mainRef.current?.focus({ preventScroll: true }));
  }, []);

  // The template lives in the URL so the browser back button returns to the gallery.
  useEffect(() => {
    const fromUrl = () => { const id = new URLSearchParams(window.location.search).get("modele"); return TEMPLATES.some((template) => template.id === id) ? id as TemplateId : null; };
    const onPop = () => {
      const next = fromUrl();
      if (selectedRef.current && next !== selectedRef.current && leaveGuard.current && !leaveGuard.current()) {
        window.history.pushState(null, "", `?modele=${selectedRef.current}`);
        return;
      }
      show(next);
    };
    const initial = fromUrl();
    // Deferred: the URL is only readable after hydration.
    const frame = requestAnimationFrame(() => { if (initial) show(initial); });
    window.addEventListener("popstate", onPop);
    return () => { cancelAnimationFrame(frame); window.removeEventListener("popstate", onPop); };
  }, [show]);

  function navigate(id: TemplateId | null) {
    if (id === selectedRef.current) return;
    if (selectedRef.current && leaveGuard.current && !leaveGuard.current()) return;
    window.history.pushState(null, "", id ? `?modele=${id}` : window.location.pathname);
    show(id);
  }

  return <>
    <a ref={skipRef} className="skip-link" href="#studio-content">Aller au contenu</a>
    <div ref={shellRef} className="studio-shell">
      <header className="studio-header">
        <button className="brand" onClick={() => navigate(null)}>
          <img className="brand-logo" src="/brand/logo-lisnard.png" width={58} height={46} alt="" />
          <span><span className="brand-name">Le Studio</span><span className="brand-subtitle block">Générateur de visuels</span></span>
          <span className="sr-only"> — retour aux modèles</span>
        </button>
        <div className="header-actions"><HelpDialog /></div>
      </header>
      <main id="studio-content" ref={mainRef} tabIndex={-1} aria-labelledby={selectedId ? "editor-title" : "hero-title"}>
        {selectedId ? <Editor key={selectedId} templateId={selectedId} onBack={() => navigate(null)} leaveGuardRef={leaveGuard} /> : <>
          <section className="studio-hero" aria-labelledby="hero-title">
            <div><p className="eyebrow">Le studio est à vous</p><h1 id="hero-title">Vos idées,<br /><span>en un visuel.</span></h1></div>
            <div className="hero-detail"><p>Un modèle, quelques mots, un visuel prêt à partager. La mise en page s’occupe du reste.</p><div className="promise-row"><span><ShieldCheck size={14} aria-hidden="true" />Sans compte</span><span><LockKeyhole size={13} aria-hidden="true" />Sur votre appareil</span></div></div>
          </section>
          <div className="steps-strip" role="group" aria-label="Les trois étapes de création">
            <div className="step-item active"><span className="step-number">01</span><span className="step-text">Choisir un modèle</span><LayoutTemplate className="step-icon" size={15} aria-hidden="true" /></div>
            <div className="step-item"><span className="step-number">02</span><span className="step-text">Personnaliser</span><PenLine className="step-icon" size={15} aria-hidden="true" /></div>
            <div className="step-item"><span className="step-number">03</span><span className="step-text">Télécharger</span><Download className="step-icon" size={15} aria-hidden="true" /></div>
          </div>
          <section aria-labelledby="gallery-title">
            <div className="gallery-heading"><div><h2 id="gallery-title">Quel visuel souhaitez-vous créer ?</h2><p>Choisissez un point de départ. Faites-en votre visuel.</p></div><span className="gallery-count">{TEMPLATES.length} modèles · 4 formats</span></div>
            <div className="filter-row" role="group" aria-label="Filtrer les modèles par catégorie">{CATEGORIES.map((item) => <button key={item} className="filter-chip" aria-pressed={category === item} onClick={() => setCategory(item)}><span className="selection-label">{item}</span><SelectionCheck /></button>)}</div>
            <p className="sr-only" role="status">{visibleTemplates.length} {visibleTemplates.length === 1 ? "modèle disponible" : "modèles disponibles"} : {category}.</p>
            <div className="template-grid">{visibleTemplates.map((template) => <button className="template-card" key={template.id} onClick={() => navigate(template.id)}>
              <span className="sr-only">Choisir le modèle </span>
              <span className="template-image"><span className="template-tag">{template.tag}</span><PosterPreview config={GALLERY_CONFIGS[template.id]} decorative /></span>
              <span className="template-caption"><span><span className="template-name">{template.name}</span><span className="template-meta">{template.category} · 4 formats disponibles</span></span><span className="card-arrow"><ArrowRight size={14} aria-hidden="true" /></span></span>
            </button>)}</div>
            {visibleTemplates.length === 0 ? <div className="empty-gallery"><p className="mb-3 text-sm">Aucun modèle disponible dans cette catégorie.</p><Button variant="outline" onClick={() => setCategory(CATEGORIES[0])}>Voir tous les modèles</Button></div> : null}
          </section>
          <div className="gallery-note"><Info size={15} aria-hidden="true" /><p>Une même identité graphique, des formats adaptés à vos réseaux sociaux.</p></div>
        </>}
      </main>
      <footer className="studio-footer"><span>Le Studio · Projet Lisnard</span><div className="footer-links"><LegalNoticeDialog /><LegalDialog kind="rules" /><LegalDialog kind="privacy" /></div><p className="footer-disclaimer">Initiative indépendante de soutiens. Ce site ne dépend ni de Nouvelle Énergie ni de David Lisnard.</p></footer>
    </div>
  </>;
}

function validationErrors(config: PosterConfig): Record<string, string> {
  const template = TEMPLATES.find((item) => item.id === config.templateId)!;
  const errors: Record<string, string> = {};
  for (const field of template.fields) {
    const value = config.values[field.key] ?? "";
    const limit = field.maxLength;
    if (field.required && !value.trim()) errors[field.key] = "Ce champ est nécessaire pour créer votre visuel.";
    else if (Array.from(value).length > limit) errors[field.key] = `Votre texte dépasse la limite de ${limit} caractères. Raccourcissez-le pour continuer.`;
    else if (field.type === "date" && value && !/^\d{4}-\d{2}-\d{2}$/.test(value)) errors[field.key] = "Choisissez une date valide.";
    else if (field.type === "time" && value && !/^([01]\d|2[0-3]):[0-5]\d$/.test(value)) errors[field.key] = "Choisissez une heure valide.";
  }
  return errors;
}

function Field({ field, value, limit, error, onChange }: { field: TemplateField; value: string; limit: number; error?: string; onChange: (value: string) => void }) {
  const id = `field-${field.key}`;
  const hasCounter = field.type !== "date" && field.type !== "time";
  const props = { id, value, placeholder: field.placeholder, onChange: (event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => onChange(event.target.value), "aria-invalid": Boolean(error), "aria-describedby": `${id}-help${hasCounter ? ` ${id}-count` : ""}`, required: field.required };
  return <div>
    <div className="field-label-row"><Label htmlFor={id}>{field.label}<span className="ml-1.5 text-sm font-normal text-muted-foreground">({field.required ? "obligatoire" : "facultatif"})</span></Label>{hasCounter ? <span className="field-count" id={`${id}-count`}><span className="sr-only">Caractères saisis : </span>{Array.from(value).length}<span aria-hidden="true">/</span><span className="sr-only"> sur </span>{limit}</span> : null}</div>
    {field.type === "textarea" ? <Textarea {...props} rows={3} /> : <Input {...props} type={field.type} />}
    <p id={`${id}-help`} className={error ? "field-error" : "field-hint"}>{error ?? (field.type === "date" ? "Choisissez la date de l’événement." : field.type === "time" ? "Indiquez l’heure de début." : `${limit} caractères maximum. La taille du texte s’ajuste automatiquement.`)}</p>
  </div>;
}

function canvasBlob(canvas: HTMLCanvasElement, kind: "png" | "jpeg"): Promise<Blob> {
  return new Promise((resolve, reject) => canvas.toBlob((blob) => blob ? resolve(blob) : reject(new Error("Impossible de préparer l’image. Réessayez.")), `image/${kind}`, kind === "jpeg" ? .94 : undefined));
}

function Editor({ templateId, onBack, leaveGuardRef }: { templateId: TemplateId; onBack: () => void; leaveGuardRef: RefObject<(() => boolean) | null> }) {
  const template = TEMPLATES.find((item) => item.id === templateId)!;
  const [config, setConfig] = useState(() => createDefaultConfig(templateId));
  const [editedFields, setEditedFields] = useState<Record<string, boolean>>({});
  const [status, setStatus] = useState<PreviewStatus & { config: PosterConfig }>({ config, ready: false, fits: true, altText: describePoster(config) });
  const [kind, setKind] = useState<"png" | "jpeg">("png");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [messageError, setMessageError] = useState(false);
  const [imageImporting, setImageImporting] = useState(false);
  const [imageError, setImageError] = useState("");
  const [result, setResult] = useState<{ url: string; fileName: string; size: number; width: number; height: number; altText: string; kind: string } | null>(null);
  const [resultOpen, setResultOpen] = useState(false);
  const exportPending = useRef(false);
  const shareFile = useRef<File | null>(null);
  const downloadRef = useRef<HTMLButtonElement>(null);
  const resultUrl = useRef<string | null>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const imageButtonRef = useRef<HTMLButtonElement>(null);
  const imageUrl = useRef<string | null>(null);
  const imageImportVersion = useRef(0);
  const imageImportPending = useRef(false);
  const [logoImporting, setLogoImporting] = useState(false);
  const [logoError, setLogoError] = useState("");
  const logoInputRef = useRef<HTMLInputElement>(null);
  const logoUrl = useRef<string | null>(null);
  const logoImportVersion = useRef(0);
  const mountedRef = useRef(true);
  const configRef = useRef(config);
  const savedConfigRef = useRef(config);
  const [canShare, setCanShare] = useState(false);
  const format = FORMATS.find((item) => item.id === config.formatId)!;
  const validation = useMemo(() => validationErrors(config), [config]);
  const errors = templateId === "quote" ? Object.fromEntries(Object.entries(validation).filter(([key]) => editedFields[key])) : validation;
  const missingImage = template.photo && !config.image;
  const currentStatus = status.config === config ? status : null;
  const renderBlocked = currentStatus ? !currentStatus.fits || Boolean(currentStatus.error) : false;
  const canExport = !renderBlocked && Object.keys(validation).length === 0 && !missingImage && !imageImporting && !logoImporting;
  const usesAccent = templateId !== "photo" && !(templateId === "type" && config.variant === "classic");
  const previewOk = !imageImporting && !Object.keys(validation).length && !missingImage && !renderBlocked;
  const exportHelp = logoImporting ? "La préparation de votre logo est en cours." : imageImporting ? "La préparation de votre image est en cours." : Object.keys(validation).length ? Object.keys(errors).length ? "Corrigez les champs signalés pour activer le téléchargement." : "Saisissez votre citation pour activer le téléchargement." : missingImage ? "Ajoutez votre image pour activer le téléchargement." : renderBlocked && !currentStatus?.error ? "Raccourcissez votre texte pour activer le téléchargement." : null;

  useEffect(() => { configRef.current = config; }, [config]);

  useEffect(() => {
    leaveGuardRef.current = () => configRef.current === savedConfigRef.current || window.confirm("Quitter ce modèle ? Vos modifications non téléchargées seront perdues.");
    // Reload or tab close: let the browser ask before dropping unsaved changes.
    const beforeUnload = (event: BeforeUnloadEvent) => { if (configRef.current !== savedConfigRef.current) event.preventDefault(); };
    window.addEventListener("beforeunload", beforeUnload);
    return () => { leaveGuardRef.current = null; window.removeEventListener("beforeunload", beforeUnload); };
  }, [leaveGuardRef]);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      imageImportVersion.current += 1;
      if (imageUrl.current) URL.revokeObjectURL(imageUrl.current);
      logoImportVersion.current += 1;
      if (logoUrl.current) URL.revokeObjectURL(logoUrl.current);
      if (resultUrl.current) URL.revokeObjectURL(resultUrl.current);
    };
  }, []);

  const onStatus = useCallback((next: PreviewStatus) => {
    setStatus({ ...next, config });
  }, [config]);

  function updateConfig(update: Partial<PosterConfig>) { setConfig((previous) => ({ ...previous, ...update })); setMessage(""); }
  function updateValue(key: string, value: string) { setEditedFields((previous) => ({ ...previous, [key]: true })); setConfig((previous) => ({ ...previous, values: { ...previous.values, [key]: value } })); setMessage(""); }
  function notify(text: string, error = false) { setMessage(text); setMessageError(error); }

  async function importImage(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file || exportPending.current) return;
    const version = ++imageImportVersion.current;
    imageImportPending.current = true;
    setImageImporting(true);
    setImageError("");
    setMessage("");
    try {
      const image = await importPosterImage(file);
      if (version !== imageImportVersion.current) { URL.revokeObjectURL(image.src); return; }
      const previousUrl = imageUrl.current;
      imageUrl.current = image.src;
      updateConfig({ image });
      if (previousUrl) URL.revokeObjectURL(previousUrl);
    } catch (error) {
      if (version === imageImportVersion.current) setImageError(error instanceof Error ? error.message : "Votre image n’a pas pu être importée. Réessayez.");
    } finally {
      if (version === imageImportVersion.current) {
        imageImportPending.current = false;
        setImageImporting(false);
      }
    }
  }

  function clearImage() {
    imageImportVersion.current += 1;
    imageImportPending.current = false;
    setImageImporting(false);
    setImageError("");
    if (imageUrl.current) URL.revokeObjectURL(imageUrl.current);
    imageUrl.current = null;
    if (imageInputRef.current) imageInputRef.current.value = "";
  }

  function removeImage() { if (exportPending.current) return; clearImage(); updateConfig({ image: undefined }); requestAnimationFrame(() => imageButtonRef.current?.focus()); }
  async function importLogo(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file || exportPending.current) return;
    const version = ++logoImportVersion.current;
    setLogoImporting(true);
    setLogoError("");
    setMessage("");
    try {
      const logo = await importPosterImage(file);
      if (version !== logoImportVersion.current) { URL.revokeObjectURL(logo.src); return; }
      const previousUrl = logoUrl.current;
      logoUrl.current = logo.src;
      updateConfig({ logo });
      if (previousUrl) URL.revokeObjectURL(previousUrl);
    } catch (error) {
      if (version === logoImportVersion.current) setLogoError(error instanceof Error ? error.message : "Votre logo n’a pas pu être importé. Réessayez.");
    } finally {
      if (version === logoImportVersion.current) setLogoImporting(false);
    }
  }

  function clearLogo() {
    logoImportVersion.current += 1;
    setLogoImporting(false);
    setLogoError("");
    if (logoUrl.current) URL.revokeObjectURL(logoUrl.current);
    logoUrl.current = null;
  }

  function removeLogo() { if (exportPending.current) return; clearLogo(); updateConfig({ logo: undefined }); }

  function resetEditor() { if (exportPending.current) return; clearImage(); clearLogo(); const fresh = createDefaultConfig(templateId); savedConfigRef.current = fresh; setConfig(fresh); setEditedFields({}); setMessage(""); }

  async function prepareFile(): Promise<File> {
    if (!canExport || imageImportPending.current) throw new Error("Vérifiez vos champs et votre image avant de télécharger.");
    // This canvas belongs to the click's config, never to an older preview.
    const canvas = document.createElement("canvas");
    const rendered = await renderPoster(canvas, config);
    if (!mountedRef.current) throw new Error("La création a été fermée.");
    if (rendered.error || !rendered.fits) throw new Error(rendered.error ?? "Le texte ne tient pas dans ce format. Raccourcissez-le ou choisissez un autre format.");
    const blob = await canvasBlob(canvas, kind);
    if (blob.size > MAX_EXPORT_BYTES) throw new Error("Cette image est trop volumineuse. Essayez le format JPEG.");
    return new File([blob], `studio-${templateId}-${config.formatId}.${kind === "jpeg" ? "jpg" : "png"}`, { type: blob.type });
  }

  async function download() {
    if (exportPending.current) return;
    exportPending.current = true;
    setBusy(true); setMessage("");
    try {
      const file = await prepareFile();
      if (!mountedRef.current) return;
      if (resultUrl.current) URL.revokeObjectURL(resultUrl.current);
      const url = URL.createObjectURL(file); resultUrl.current = url;
      const link = document.createElement("a"); link.href = url; link.download = file.name; document.body.appendChild(link); link.click(); link.remove();
      savedConfigRef.current = config;
      setCanShare(typeof navigator.canShare === "function" && navigator.canShare({ files: [file] }));
      shareFile.current = file;
      setResult({ url, fileName: file.name, size: file.size, width: format.width, height: format.height, altText: describePoster(config), kind: kind.toUpperCase() });
      setResultOpen(true);
      notify("Votre image est prête. Le téléchargement a été lancé.");
    } catch (error) { if (mountedRef.current) notify(error instanceof Error ? error.message : "Le téléchargement a échoué. Réessayez.", true); }
    finally { exportPending.current = false; if (mountedRef.current) setBusy(false); }
  }

  async function share() {
    if (!shareFile.current) return;
    try { await navigator.share({ files: [shareFile.current], title: template.name }); }
    catch (error) { if (!(error instanceof DOMException && error.name === "AbortError")) notify("Le partage a échoué. Utilisez le fichier téléchargé.", true); }
  }

  return <>
    <div className="editor-top"><button className="back-button" onClick={onBack}><ArrowLeft size={15} aria-hidden="true" />Tous les modèles</button><span className="editor-step">02 · Personnaliser votre visuel</span></div>
    <div className="editor-grid">
      <section className="editor-panel" aria-labelledby="editor-title">
        <div className="editor-panel-heading"><p className="eyebrow"><PenLine size={12} aria-hidden="true" />À vous de jouer</p><h1 id="editor-title">{template.name}</h1><p>{template.description}</p></div>
        <div className="editor-fields">
          {template.fields.filter((field) => field.type !== "date" && field.type !== "time").map((field) => <Field key={field.key} field={field} value={config.values[field.key] ?? ""} limit={field.maxLength} error={errors[field.key]} onChange={(value) => updateValue(field.key, value)} />)}
          {templateId === "event" ? <div className="field-columns">{template.fields.filter((field) => field.type === "date" || field.type === "time").map((field) => <Field key={field.key} field={field} value={config.values[field.key] ?? ""} limit={field.maxLength} error={errors[field.key]} onChange={(value) => updateValue(field.key, value)} />)}</div> : null}
          {template.photo ? <div className="editor-divider image-import">
            <p className="option-label flex items-center gap-2"><ImageIcon size={16} aria-hidden="true" />Votre image<span className="text-sm font-normal text-muted-foreground">(obligatoire)</span></p>
            <input ref={imageInputRef} id="image-file" hidden type="file" accept={IMAGE_ACCEPT} aria-label="Votre image" aria-invalid={Boolean(imageError)} aria-describedby={`image-help${imageError ? " image-error" : ""}`} onChange={importImage} />
            {config.image ? <figure className="image-import-preview">
              <img src={config.image.src} width={config.image.width} height={config.image.height} alt={`Image importée : ${config.image.name}`} />
              <figcaption>{config.image.name}</figcaption>
            </figure> : null}
            <div className="image-import-actions">
              <Button ref={imageButtonRef} type="button" variant="outline" disabled={busy} onClick={() => imageInputRef.current?.click()} aria-describedby={`image-help${imageError ? " image-error" : ""}`}><Upload className="size-4" aria-hidden="true" />{config.image ? "Remplacer l’image" : "Ajouter mon image"}</Button>
              {config.image || imageImporting ? <Button type="button" variant="ghost" disabled={busy} onClick={removeImage}><Trash2 className="size-4" aria-hidden="true" />{config.image ? "Supprimer l’image" : "Annuler l’import"}</Button> : null}
            </div>
            <p id="image-help" className="field-hint">{IMAGE_IMPORT_HELP} L’image est recadrée automatiquement selon le format.</p>
            {imageImporting ? <p className="field-hint" role="status"><LoaderCircle className="mr-2 inline size-4 animate-spin" aria-hidden="true" />Préparation de votre image…</p> : null}
            {imageError ? <p id="image-error" className="field-error" role="alert">{imageError}</p> : null}
          </div> : null}
          <div className="editor-divider"><p className="option-label" id="palette-label">Votre couleur</p><div className="palette-scroll"><div className="palette-group" role="group" aria-labelledby="palette-label">{PALETTES.map((palette) => <button key={palette.id} className="palette-button" aria-pressed={config.paletteId === palette.id} onClick={() => updateConfig({ paletteId: palette.id })}><span className="palette-content"><span className="palette-swatch" aria-hidden="true" style={{ background: palette.background }} /><span className="palette-button-label">{palette.label}</span></span><SelectionCheck /></button>)}</div></div></div>
          <details className="editor-more">
            <summary><SlidersHorizontal size={16} aria-hidden="true" />Plus d’options<span className="editor-more-hint">Logo, texte du bas, encadrés, composition</span></summary>
            <div className="editor-more-body">
          <div className="editor-divider image-import">
            <p className="option-label flex items-center gap-2"><ImageIcon size={16} aria-hidden="true" />Votre logo<span className="text-sm font-normal text-muted-foreground">(facultatif)</span></p>
            <input ref={logoInputRef} hidden type="file" accept={IMAGE_ACCEPT} aria-label="Votre logo" aria-invalid={Boolean(logoError)} onChange={importLogo} />
            {config.logo ? <figure className="image-import-preview"><img src={config.logo.src} width={config.logo.width} height={config.logo.height} alt={`Logo importé : ${config.logo.name}`} /><figcaption>{config.logo.name}</figcaption></figure> : null}
            <div className="image-import-actions">
              <Button type="button" variant="outline" disabled={busy || logoImporting} onClick={() => logoInputRef.current?.click()} aria-describedby={`logo-help${logoError ? " logo-error" : ""}`}><Upload className="size-4" aria-hidden="true" />{config.logo ? "Remplacer le logo" : "Utiliser mon logo"}</Button>
              {config.logo ? <Button type="button" variant="ghost" disabled={busy} onClick={removeLogo}><Trash2 className="size-4" aria-hidden="true" />Revenir au logo Nouvelle Énergie</Button> : null}
            </div>
            <p id="logo-help" className="field-hint">{IMAGE_IMPORT_HELP} Préférez un PNG à fond transparent.</p>
            {logoImporting ? <p className="field-hint" role="status"><LoaderCircle className="mr-2 inline size-4 animate-spin" aria-hidden="true" />Préparation de votre logo…</p> : null}
            {logoError ? <p id="logo-error" className="field-error" role="alert">{logoError}</p> : null}
          </div>
          <div className="editor-divider">
            <label className="option-label" htmlFor="footer-text">Texte en bas du visuel</label>
            <Input id="footer-text" value={config.footerText ?? POSTER_WEBSITE_URL} maxLength={60} placeholder="Laisser vide pour ne rien afficher" aria-describedby="footer-help" onChange={(event) => updateConfig({ footerText: event.target.value })} />
            <p id="footer-help" className="field-hint">Votre site, un texte ou rien : laissez vide pour retirer la ligne.</p>
            {config.footerText !== undefined && config.footerText !== POSTER_WEBSITE_URL ? <Button type="button" variant="ghost" size="sm" onClick={() => updateConfig({ footerText: undefined })}>Remettre l’adresse du site</Button> : null}
          </div>
          {usesAccent ? <div className="editor-divider"><p className="option-label" id="accent-label">Couleur des encadrés</p><div className="palette-scroll"><div className="palette-group" role="group" aria-labelledby="accent-label">{ACCENT_COLORS.filter((accent) => accent.color !== PALETTES.find((palette) => palette.id === config.paletteId)?.background).map((accent) => <button key={accent.id} className="palette-button" aria-pressed={resolveAccent(config) === accent.color} onClick={() => updateConfig({ accentId: accent.id })}><span className="palette-content"><span className="palette-swatch" aria-hidden="true" style={{ background: accent.color }} /><span className="palette-button-label">{accent.label}</span></span><SelectionCheck /></button>)}</div></div></div> : null}
          <div className="editor-divider"><p className="option-label" id="variant-label">Votre composition</p><div className="variant-group" role="group" aria-labelledby="variant-label"><button className="variant-button" aria-pressed={config.variant === "classic"} onClick={() => updateConfig({ variant: "classic" })}><span className="selection-label">Classique</span><SelectionCheck /></button><button className="variant-button" aria-pressed={config.variant === "bold"} onClick={() => updateConfig({ variant: "bold" })}><span className="selection-label">Affirmée</span><SelectionCheck /></button></div></div>
            </div>
          </details>
          <p className="field-hint flex items-start gap-2"><LockKeyhole size={12} className="mt-0.5 shrink-0" aria-hidden="true" />La mise en page reste celle du modèle : vos textes s’y adaptent automatiquement.</p>
          <Button variant="ghost" size="sm" disabled={busy} onClick={resetEditor}>Revenir au modèle de départ</Button>
        </div>
      </section>
      <section className="preview-panel" aria-labelledby="preview-heading">
        <div className="preview-sticky">
        <div className="preview-toolbar"><h2 className="preview-label" id="preview-heading"><span className="local-dot" />Votre aperçu</h2><span className="preview-status">{!imageImporting ? <>{previewOk ? <Check size={16} aria-hidden="true" /> : <CircleAlert size={16} aria-hidden="true" />}{Object.keys(validation).length ? Object.keys(errors).length ? "Champs à vérifier" : "Ajoutez votre citation" : missingImage ? "Ajoutez votre image" : renderBlocked ? currentStatus?.error ? "Aperçu indisponible" : "Texte à raccourcir" : "Aperçu en direct"}</> : <><LoaderCircle size={16} className="animate-spin" aria-hidden="true" />Préparation de l’image…</>}</span></div>
        <div className="format-group mb-4" role="group" aria-label="Format du visuel">{FORMATS.map((item) => { const Icon = FORMAT_ICONS[item.id]; return <button key={item.id} className="format-button" aria-pressed={config.formatId === item.id} onClick={() => updateConfig({ formatId: item.id as FormatId })}><span className="selection-content"><Icon size={16} aria-hidden="true" /><span className="selection-label">{item.label}</span></span><SelectionCheck /></button>; })}</div>
        <div className={`preview-stage is-${config.formatId}`} style={{ "--ratio": format.width / format.height } as React.CSSProperties}><PosterPreview config={config} onStatus={onStatus} /></div>
        </div>
        <div className="preview-metadata"><span>{format.width} × {format.height} px</span><span>Image haute résolution</span></div>
        <div className="export-panel">
          <Select value={kind} onValueChange={(value) => setKind(value as "png" | "jpeg")}><SelectTrigger className="export-type h-11" aria-label="Type de fichier"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="png">PNG</SelectItem><SelectItem value="jpeg">JPEG</SelectItem></SelectContent></Select>
          <Button ref={downloadRef} className="export-button" aria-describedby={exportHelp ? "export-help" : undefined} disabled={!canExport || busy} onClick={download}>{busy ? <LoaderCircle className="size-4 animate-spin" aria-hidden="true" /> : <Download className="size-4" aria-hidden="true" />}Télécharger mon visuel</Button>
        </div>
        {exportHelp ? <p id="export-help" className="export-note">{exportHelp}</p> : null}
        {currentStatus?.error && Object.keys(validation).length === 0 && !missingImage ? <p role="alert" className="notice error">{currentStatus.error}</p> : null}
        {Object.keys(errors).length > 0 ? <div className="notice error" role="alert"><p>Corrigez les champs suivants avant de télécharger votre visuel :</p><ul className="mt-2 list-disc pl-5">{template.fields.filter((field) => errors[field.key]).map((field) => <li key={field.key}><a href={`#field-${field.key}`} onClick={(event) => { event.preventDefault(); document.getElementById(`field-${field.key}`)?.focus(); }}>{field.label} : {errors[field.key]}</a></li>)}</ul></div> : null}
        {currentStatus?.ready && !currentStatus.fits && !currentStatus.error && Object.keys(validation).length === 0 ? <p className="notice error" role="alert">Le texte ne tient pas dans ce format. Raccourcissez-le ou choisissez un autre format.</p> : null}
        {message ? <p className={`notice${messageError ? " error" : ""}`} role={messageError ? "alert" : "status"}>{message}</p> : null}
      </section>
    </div>
    <Dialog open={resultOpen} onOpenChange={setResultOpen}><DialogContent className="sm:max-w-md [scrollbar-gutter:stable_both-edges]" onCloseAutoFocus={(event) => { event.preventDefault(); if (downloadRef.current?.isConnected) downloadRef.current.focus(); }}><DialogHeader align="center"><div className="success-icon"><CheckCircle2 size={27} aria-hidden="true" /></div><DialogTitle>Votre visuel est prêt.</DialogTitle><DialogDescription>Le téléchargement a été lancé. Vous pouvez continuer à personnaliser votre création.</DialogDescription></DialogHeader>
      {result ? <><div className="mx-auto max-h-64 overflow-hidden rounded-md border bg-muted">
        <img className="max-h-64 max-w-full w-auto object-contain" src={result.url} alt={result.altText} /></div><p className="text-center text-sm text-muted-foreground">{result.kind} · {result.width} × {result.height} px · {Math.max(1, Math.round(result.size / 1024))} Ko</p></> : null}
      {canShare ? <Button onClick={share}><Share2 className="size-4" aria-hidden="true" />Partager</Button> : null}
      <Button variant={canShare ? "outline" : "default"} onClick={() => setResultOpen(false)}>Continuer à personnaliser</Button><Button variant="outline" onClick={() => { setResultOpen(false); onBack(); }}>Créer un nouveau visuel<ArrowRight className="size-4" aria-hidden="true" /></Button>
    </DialogContent></Dialog>
  </>;
}
