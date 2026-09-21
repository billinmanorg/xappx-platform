import { Nav } from "./components/Nav";
import { Hero } from "./components/Hero";
import { ProcessStory } from "./components/ProcessStory";
import { ProductTiles } from "./components/ProductTiles";
import { IndustryEntry } from "./components/IndustryEntry";
import { WhyXappx } from "./components/WhyXappx";
import { Ventures } from "./components/Ventures";
import { Founders } from "./components/Founders";
import { Footer } from "./components/Footer";

export default function App() {
  return (
    <>
      <Nav />
      <main>
        <Hero />
        <ProcessStory />
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
