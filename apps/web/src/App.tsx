import { Nav } from "./components/Nav";
import { Hero } from "./components/Hero";
import { ProcessStory } from "./components/ProcessStory";
import { ProductTiles } from "./components/ProductTiles";
import { IndustryEntry } from "./components/IndustryEntry";
import { WhyXappx } from "./components/WhyXappx";
import { UseCases } from "./components/UseCases";
import { Founders } from "./components/Founders";
import { Footer } from "./components/Footer";
import { BuildPage } from "./build/BuildPage";
import { SolutionsPage } from "./solutions/SolutionsPage";
import { DataLicensingPage } from "./dataLicensing/DataLicensingPage";
import { TwinMediaPage } from "./twinMedia/TwinMediaPage";
import { DATA_LICENSING } from "./lib/routes";

function Home() {
  return (
    <>
      <Nav />
      <main>
        <Hero />
        <ProcessStory />
        {/* <VideoSection /> — disabled for now; re-add to re-enable */}
        <ProductTiles />
        <IndustryEntry />
        <WhyXappx />
        <UseCases />
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
  if (path === "/solutions") return <SolutionsPage />;
  if (path === "/twin-media") return <TwinMediaPage />;
  if (path === DATA_LICENSING.previewPath) return <DataLicensingPage preview />;
  if (DATA_LICENSING.PUBLIC && path === DATA_LICENSING.path) return <DataLicensingPage />;
  return <Home />;
}
