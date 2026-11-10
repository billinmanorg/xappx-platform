import { useEffect, useState, type FormEvent } from "react";
import { motion } from "framer-motion";
import { fadeUp, stagger, inView } from "../lib/motion";
import { Nav } from "../components/Nav";
import { Footer } from "../components/Footer";
import { HeroWorkflowDemo } from "../components/HeroWorkflowDemo";
import { MicButton } from "../components/MicButton";
import { getLeadService } from "../build/leadService";
import { TwinChatMock, MediaMock, ConsultingMock } from "./mocks";
import "./SolutionsPage.css";

/**
 * /solutions: the storefront for everything XAPPX sells (Bill, 2026-11-10).
 * Four products, each explained by XAPPY, with one contact form at the end.
 * The guided app-building flow (/build) is reached from the first product only.
 */
type ProductId = "apps" | "twins" | "media" | "consulting";

interface Product {
  id: ProductId;
  num: string;
  name: string;
  title: string;
  body: string;
  points: string[];
  xappy: string;
  cta: { label: string; href: string };
}

const PRODUCTS: Product[] = [
  {
    id: "apps", num: "01", name: "AI App Development",
    title: "Turn a business problem into a working app.",
    body: "Tell XAPPY what isn't working. The guided flow maps the problem, designs the solution, and generates a prototype you can click, built on the Twin Vault. XAPPX experts then take it to production.",
    points: [
      "Guided discovery in minutes, no technical knowledge needed",
      "A blueprint and a clickable prototype before anyone commits",
      "Built on the Twin Vault, so your data stays under your control",
      "An Agent Organization that keeps working for you after launch",
    ],
    xappy: "Give me the problem in one sentence. I'll find the workflow, the people in it, and where AI removes the busywork. Then I build a prototype you can click before anyone writes a check.",
    cta: { label: "Build my solution", href: "/build" },
  },
  {
    id: "twins", num: "02", name: "AI Twins",
    title: "Twin Chat and the Twin Vault: an AI twin for every person on your team.",
    body: "Twin Chat is the private-label AI chat your clients and staff use every day. The Twin Vault underneath it is where each person's data lives, under their own control. Together they are the platform the rest of our apps plug into.",
    points: [
      "White-labelled with your name and colours",
      "Every user gets their own Vault",
      "Apps and skills switched on per client: CRM, events, market intelligence, media",
      "Enterprise agreements for teams of 100 and up",
    ],
    xappy: "Picture Twin Chat with your logo on it. Your agents answer clients, your Vault keeps the records, and we switch on exactly the apps your business needs.",
    cta: { label: "Talk to us about Twin Chat", href: "#contact" },
  },
  {
    id: "media", num: "03", name: "AI Media",
    title: "Videos and podcasts, made for you every day.",
    body: "Our media team and XAPPY's agents produce the content that keeps your business visible: explainer and promo videos, an AI version of you on camera, and a daily local podcast in your own voice.",
    points: [
      "AI explainer and promo videos, scripted and produced for you",
      "Your AI twin on camera, from a few photos",
      "A daily local podcast in your voice: weather, events and news for your market, posted automatically",
      "Everything delivered into your Vault",
    ],
    xappy: "Say the word and tomorrow morning there's a seven-minute podcast about your market, in your voice, already posted.",
    cta: { label: "Request media", href: "#contact" },
  },
  {
    id: "consulting", num: "04", name: "Consulting",
    title: "Not sure where AI fits? Start with a conversation.",
    body: "We work with your leadership to find the places where AI pays for itself, then build or configure the pieces above. Current engagements include pharmaceutical and real estate.",
    points: [
      "AI readiness review of your operation",
      "A roadmap with costs and sequence",
      "Hands-on delivery with our own products",
    ],
    xappy: "Bring the messy version. We'll leave with a plan and a first build.",
    cta: { label: "Book a conversation", href: "#contact" },
  },
];

function startFromVoice(text: string) {
  try { sessionStorage.setItem("xappx_voice_problem", text); } catch { /* ignore */ }
  window.location.href = "/build";
}

export function SolutionsPage() {
  useEffect(() => {
    document.title = "XAPPX · Solutions";
    // Land on a product when the URL carries its anchor.
    const id = window.location.hash.replace("#", "");
    if (id) window.setTimeout(() => document.getElementById(id)?.scrollIntoView({ block: "start" }), 50);
  }, []);

  return (
    <>
      <Nav />
      <main className="sol">
        <section className="sol__hero" id="top">
          <div className="container">
            <motion.div variants={stagger(0.1)} initial="hidden" animate="show">
              <motion.p className="eyebrow" variants={fadeUp}>Solutions</motion.p>
              <motion.h1 className="sol__title" variants={fadeUp}>
                Every way XAPPX turns a business problem into an <span>AI solution</span>.
              </motion.h1>
              <motion.p className="lede sol__lede" variants={fadeUp}>
                Four products, one team. Start with the one that matches the problem in front of you. XAPPY explains each.
              </motion.p>
              <motion.nav className="sol__jump" aria-label="Products" variants={fadeUp}>
                {PRODUCTS.map((p) => (
                  <a key={p.id} href={`#${p.id}`}><span>{p.num}</span>{p.name}</a>
                ))}
              </motion.nav>
            </motion.div>
          </div>
        </section>

        {PRODUCTS.map((p, i) => (
          <section key={p.id} id={p.id} className={"prod section" + (i % 2 ? " prod--flip" : "")}>
            <div className="container prod__in">
              <motion.div className="prod__copy" variants={stagger(0.08)} initial="hidden" whileInView="show" viewport={inView}>
                <motion.p className="eyebrow" variants={fadeUp}><span className="prod__num">{p.num}</span> {p.name}</motion.p>
                <motion.h2 variants={fadeUp}>{p.title}</motion.h2>
                <motion.p className="prod__body" variants={fadeUp}>{p.body}</motion.p>
                <motion.ul className="prod__points" variants={fadeUp}>
                  {p.points.map((pt) => <li key={pt}>{pt}</li>)}
                </motion.ul>
                <motion.figure className="xappy" variants={fadeUp}>
                  <img src="/xappy-face.png" alt="" width="40" height="40" />
                  <figcaption><span className="xappy__who">XAPPY explains</span><p>{p.xappy}</p></figcaption>
                </motion.figure>
                <motion.div className="prod__cta" variants={fadeUp}>
                  <a className="btn btn-primary" href={p.cta.href} data-product={p.name}>{p.cta.label} →</a>
                  {p.id === "apps" && <MicButton size="lg" label="Or tell XAPPY what isn't working" onText={startFromVoice} />}
                </motion.div>
              </motion.div>
              <motion.div className="prod__visual" initial={{ opacity: 0, y: 18 }} whileInView={{ opacity: 1, y: 0 }} viewport={inView} transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}>
                {p.id === "apps" && <HeroWorkflowDemo />}
                {p.id === "twins" && <TwinChatMock />}
                {p.id === "media" && <MediaMock />}
                {p.id === "consulting" && <ConsultingMock />}
              </motion.div>
            </div>
          </section>
        ))}

        <ContactSection />
      </main>
      <Footer />
    </>
  );
}

function ContactSection() {
  const [product, setProduct] = useState<string>(PRODUCTS[1]!.name);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [company, setCompany] = useState("");
  const [message, setMessage] = useState("");
  const [state, setState] = useState<"idle" | "sending" | "sent" | "error">("idle");

  // A product CTA that points here pre-selects that product.
  useEffect(() => {
    const onClick = (e: Event) => {
      const a = (e.target as HTMLElement).closest<HTMLAnchorElement>('a[href="#contact"][data-product]');
      if (a?.dataset.product) setProduct(a.dataset.product);
    };
    document.addEventListener("click", onClick);
    return () => document.removeEventListener("click", onClick);
  }, []);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setState("sending");
    const res = await getLeadService().submit({
      name: name.trim(), email: email.trim(), company: company.trim(), message: message.trim() || undefined,
      industry: product, challenge: "Solutions page enquiry", stakeholders: [], outcomes: [], submittedAt: Date.now(),
    });
    setState(res.ok ? "sent" : "error");
  }

  return (
    <section className="contact section" id="contact">
      <div className="container contact__in">
        <motion.div variants={stagger(0.08)} initial="hidden" whileInView="show" viewport={inView}>
          <motion.p className="eyebrow" variants={fadeUp}>Talk to us</motion.p>
          <motion.h2 variants={fadeUp}>Tell us what you need.</motion.h2>
          <motion.p className="lede contact__lede" variants={fadeUp}>A XAPPX expert replies within one business day. No pricing games, no pressure.</motion.p>
        </motion.div>
        {state === "sent" ? (
          <div className="contact__done" role="status">
            <h3>Got it. Thank you.</h3>
            <p>We'll be in touch about <b>{product}</b> at {email}.</p>
          </div>
        ) : (
          <form className="contact__form" onSubmit={submit}>
            <label className="contact__field"><span>I'm interested in</span>
              <select value={product} onChange={(e) => setProduct(e.target.value)}>
                {PRODUCTS.map((p) => <option key={p.id} value={p.name}>{p.name}</option>)}
              </select>
            </label>
            <div className="contact__row">
              <label className="contact__field"><span>Name</span><input required value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" /></label>
              <label className="contact__field"><span>Work email</span><input required type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" /></label>
            </div>
            <label className="contact__field"><span>Company</span><input required value={company} onChange={(e) => setCompany(e.target.value)} autoComplete="organization" /></label>
            <label className="contact__field"><span>What's going on? <i>(optional)</i></span><textarea rows={4} value={message} onChange={(e) => setMessage(e.target.value)} /></label>
            {state === "error" && <p className="contact__err">That didn't send. Please try again, or email info.xappx@gmail.com.</p>}
            <button className="btn btn-primary" type="submit" disabled={state === "sending"}>{state === "sending" ? "Sending…" : "Send →"}</button>
          </form>
        )}
      </div>
    </section>
  );
}
