import { Nav } from "./components/Nav";
import { Hero } from "./components/Hero";
import { ProcessStory } from "./components/ProcessStory";
import { WhyXappx } from "./components/WhyXappx";
import { IndustryEntry } from "./components/IndustryEntry";
import { Footer } from "./components/Footer";

export default function App() {
  return (
    <>
      <Nav />
      <main>
        <Hero />
        <ProcessStory />
        <IndustryEntry />
        <WhyXappx />
      </main>
      <Footer />
    </>
  );
}
