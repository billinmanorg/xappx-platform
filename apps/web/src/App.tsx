import { Nav } from "./components/Nav";
import { Hero } from "./components/Hero";
import { ProcessStory } from "./components/ProcessStory";
import { VideoSection } from "./components/VideoSection";
import { ProductTiles } from "./components/ProductTiles";
import { IndustryEntry } from "./components/IndustryEntry";
import { WhyXappx } from "./components/WhyXappx";
import { Ventures } from "./components/Ventures";
import { Founders } from "./components/Founders";
import { Footer } from "./components/Footer";
import { BuildPage } from "./build/BuildPage";

function Home() {
  return (
    <>
      <Nav />
      <main>
        <Hero />
        <ProcessStory />
        <VideoSection />
        <ProductTiles />
        <IndustryEntry />
        <WhyXappx />
        <Ventures />
        <Founders />
      </main>
      <Footer />
    </>
  );
}

export default function App() {
  // Minimal path routing — the static host rewrites unknown paths to index.html
  // (public/_redirects), so the app reads the path and renders the right screen.
  const path = window.location.pathname.replace(/\/+$/, "");
  if (path === "/build") return <BuildPage />;
  return <Home />;
}
