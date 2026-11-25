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

// Data Licensing ships as an unlisted private preview until the estimator rules
// and launch checks pass (build brief, Nov 24). Flip PUBLIC to true at launch.
const DATA_LICENSING = { PUBLIC: false, previewPath: "/data-licensing-preview", path: "/data-licensing" };

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
  if (path === DATA_LICENSING.previewPath) return <DataLicensingPage preview />;
  if (DATA_LICENSING.PUBLIC && path === DATA_LICENSING.path) return <DataLicensingPage />;
  return <Home />;
}
